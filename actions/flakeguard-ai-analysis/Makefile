TMP_DIR := $(shell mktemp -d)
IMAGE_NAME := flaky-test-actions

default: build
.PHONY: build, clean, run

build:
	cp -r src $(TMP_DIR)/src
	cp -r context $(TMP_DIR)/context
	cp main.py Dockerfile .dockerignore requirements.txt $(TMP_DIR)

	docker build -t $(IMAGE_NAME) $(TMP_DIR)

	rm -rf $(TMP_DIR)

clean:
	docker rmi $(IMAGE_NAME)

run:
	docker run --env-file .env --volume ".":"/github/workspace" -it --rm $(IMAGE_NAME)

