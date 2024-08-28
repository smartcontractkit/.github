# license-checker

This action checks the licenses of all dependencies in a project and ensures
that they are all allowed.

This is a thin wrapper around
[pivotal/LicenseFinder](https://github.com/pivotal/LicenseFinder). See the
`pivotal/LicenseFinder` documentation for more information.

This should be ran after all dependencies are installed (including dependencies
in subdirectories) and before the build.

## Update licenses

These commands should be ran from this directory to update the global license
list.

### Add a permitted license

```sh
license_finder permitted_licenses add MIT
```

### Add a restricted license

We still have to add the license as a permitted license. Explicitly adding
restricted licenses will take precedence over the permitted licenses.

```sh
license_finder restricted_licenses add YPL-1.1
```
