# ci-beholder-schema-validate

> Action to validate beholder schemas

## Running app in docker

you can demo the application by building the docker image

```shell
docker build -t ci-beholder:latest . --no-cache
```

then running the app in the container

```shell
docker run --rm -v ./src/beholder_config.txt:/opt/beholder_config.txt beholder-ci:latest validate -f /opt/beholder_config.txt
```

#### whats happening in the command above

- `run --rm` runs the container, and when the process running in the container
  exits, delete the container
- `-v ./src/beholder_config.txt:/opt/beholder_config.txt` we are mounting a
  local file to the container, at the location `/opt/`. In Github actions the
  whole repo is mounted automatically to the container
- `beholder-ci:latest` image that we want to run
- `validate -f /opt/beholder_config.txt` is the command to the app we want to
  run along with relevant flags`
