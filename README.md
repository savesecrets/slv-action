# :gear: `slv-action` ![](https://github.com/savesecrets/slv-action/workflows/Tests/badge.svg)
> This action downloads and sets up the [SLV][slv] CLI and helps in injecting vault secrets as masked environment variables for workflows to consume.

## About
This action can be run on `ubuntu-latest`, `windows-latest`, and `macos-latest` GitHub Actions runners, and will install and expose the specified version of the [`slv`](slv) CLI on the runner environment.

## Usage

Only setup the [`slv`](slv) CLI:

```yaml
steps:
- name: Setup SLV
  uses: savesecrets/slv-action@main
```

A specific version of the [`slv`](slv) CLI can also be installed:

```yaml
steps:
- name: Setup SLV
  uses: ssavesecrets/slv-action@main
  with:
    version: 0.1.5
```

Load SLV secrets into environment variables:

```yaml
steps:
- name: Load SLV Secrets
  uses: savesecrets/slv-action@main
  with:
    vault: pets.slv.yml
    env-secret-key: ${{ secrets.SLV_ENV_SECRET_KEY }}
```

Optionally specify a prefix that will be added to the environment variables in front of the secret names:

```yaml
steps:
- name: Load SLV Secrets - PROD
  uses: savesecrets/slv-action@main
  with:
    version: 0.1.5
    vault: pets.slv.yml
    env-secret-key: ${{ secrets.SLV_ENV_SECRET_KEY }}
    prefix: "PROD_"
```

## Inputs
The actions supports the following inputs:

- `version`: The version of `slv` to install, defaulting to `latest`
- `vault`: Path to the vault file
- `env-secret-key`: The SLV environment secret (key/binding) to use for the action
- `prefix`: Prefix to use for the environment variable names along with the SLV secret name

[slv]: https://github.com/savesecrets/slv