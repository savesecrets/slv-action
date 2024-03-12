const exec = require('@actions/exec');
const os = require('os');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const { Octokit } = require("@octokit/rest");
let octokit;
const token = core.getInput('github-token');
const userAgent = 'slv-action';
if (token) {
  const { createTokenAuth } = "@octokit/auth-token";
  octokit = new Octokit({
    authStrategy: createTokenAuth,
    auth: token,
    userAgent: userAgent,
  });
} else {
  octokit = new Octokit({
    userAgent: userAgent,
  });
}

const owner = 'savesecrets';
const repo = 'slv-release';
const assetName = 'slv';

async function findInstalledVersion() {
  const options = {
    silent: true,
    failOnStdErr: true
  };
  try {
    const execOutput = await exec.getExecOutput('slv', ['--version'], options);
    let installedVersion = '';
    const lines = execOutput.stdout.split("\n");
    lines.forEach(line => {
      if (line.toLowerCase().includes("slv version")) {
        installedVersion = line.split(':')[1];
        installedVersion = installedVersion.trim();
      }
    });
    core.saveState('SLV_VERSION_INSTALLED', installedVersion);
    return installedVersion;
  } catch (error) {
    return '';
  }
}

async function getInstalledVersion() {
  let installedVersion = core.getState('SLV_VERSION_INSTALLED');
  if (installedVersion === undefined || installedVersion === '') {
    installedVersion = await findInstalledVersion();
  }
  if (installedVersion) {
    core.info(`Installed version of SLV: ${ installedVersion }`);
  }
  return installedVersion;
}

async function getLatestVersion() {
  try {
    let latestVersion = core.getState('SLV_VERSION_LATEST');
    if (latestVersion === undefined || latestVersion === '') {
      core.info('Fetching latest release version from GitHub...');
      const latestRelease = await octokit.rest.repos.getLatestRelease({
        owner: owner,
        repo: repo
      });
      latestVersion = latestRelease.data.tag_name;
      if (latestVersion.startsWith('v')) {
        latestVersion = latestVersion.slice(1);
      }
      core.saveState('SLV_VERSION_LATEST', latestVersion);
    }
    return latestVersion;
  } catch (error) {
    core.setFailed('Error retrieving latest release version:' + error.message);
  }
}

function mapArch(arch) {
  const mappings = {
    x32: '386',
    x64: 'amd64'
  };
  return mappings[arch] || arch;
}

function mapOS(os) {
  const mappings = {
    win32: 'windows'
  };
  return mappings[os] || os;
}

async function getDownloadUrlForVersion(version) {
  const platform = os.platform();
  try {
    const release = await octokit.rest.repos.getReleaseByTag({
      owner: owner,
      repo: repo,
      tag: `v${ version }`
    });
    const assets = release.data.assets;
    if (assets.length === 0) {
      core.setFailed('No assets found in the release version ' + version);
    }
    for (let i = 0; i < assets.length; i++) {
      if (assets[i].name.includes(assetName) && 
          assets[i].name.includes(mapOS(platform)) && 
          assets[i].name.includes(mapArch(os.arch())) && 
          assets[i].name.includes('.zip')) {
        return assets[i].browser_download_url;
      }
    }
  } catch (error) {
    core.setFailed('Error retrieving download URL for version ' + version + ': ' + error.message);
    return '';
  }
  core.setFailed('No assets found for current the platform (' + mapOS(platform) + 
    '-' + mapArch(os.arch()) + ') in the release version ' + version);
  return '';
}

async function installVersion(version) {
  try {
    const downloadUrl = await getDownloadUrlForVersion(version);
    if (!downloadUrl) {
      return;
    }
    const pathToZip = await tc.downloadTool(downloadUrl);
    const pathToCLI = await tc.extractZip(pathToZip);
    core.addPath(pathToCLI);
    const installed_version = await findInstalledVersion();
    if (installed_version === version) {
      core.info(`Successfully installed SLV version ${ version }`);
    } else {
      core.setFailed(`Failed to install SLV version ${ version }`);
    }
  } catch (e) {
    core.setFailed(e);
  }
}

async function setup() {
  try {
    const installedVersion = await getInstalledVersion();
    let requiredVersion = core.getInput('version');
    if (!requiredVersion || requiredVersion === 'latest') {
      requiredVersion = await getLatestVersion();
    } else if (requiredVersion.startsWith('v')) {
      requiredVersion = requiredVersion.slice(1);
    }
    if (installedVersion && installedVersion === requiredVersion) {
      core.info(`Required version SLV ${ installedVersion } is already installed`);
      return;
    }
    await installVersion(requiredVersion);
  } catch (e) {
    core.setFailed(e);
  }
}

async function getSecrets(vaultFile, slvEnvSecretKey) {
  const options = {
    env: {
      ['SLV_ENV_SECRET_KEY']: slvEnvSecretKey
    },
    silent: true,
    ignoreReturnCode: true
  };
  const execOutput = await exec.getExecOutput('slv', ['vault', 'export', '-v', vaultFile, '--format', 'json'], options);
  if (execOutput.exitCode === 0) {
    return JSON.parse(execOutput.stdout);
  }
  core.setFailed('Failed to get secrets: ' + execOutput.stderr);
}

async function injectSecrets() {
  const slvEnvSecretKey = core.getInput('env-secret-key');
  const vaultFile = core.getInput('vault');
  if (vaultFile) {
    if (!slvEnvSecretKey) {
      core.setFailed('SLV environment secret key is required');
    }
    const secrets = await getSecrets(vaultFile, slvEnvSecretKey);
    let prefix = core.getInput('prefix');
    if (!prefix) {
      prefix = '';
    }
    for (const key in secrets) {
      core.setSecret(secrets[key]);
      core.exportVariable(prefix + key, secrets[key]);
    }
  }
}

async function run() {
  try {
    await setup();
    await injectSecrets();
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run

if (require.main === module) {
  run();
}
