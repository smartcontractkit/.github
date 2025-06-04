# ecr-image-exists

Imported from
[chainlink-github-actions/docker/image-exists](https://github.com/smartcontractkit/chainlink-github-actions/blob/main/docker/image-exists/action.yml).

## Usage

For example, only build if the image doesn't already exist.

```
    - name: Check if image exists
      id: check-image
      uses: smartcontractkit/.github/actions/ecr-image-exists@<ref>
      with:
        repository: chainlink
        tag: "v0.0.1"
        aws-role-arn: ${{ secrets.AWS_ECR_READ_ONLY_ROLE }}

    - name: Build Image
      if: steps.check-image.outputs.exists != 'true'
      ...
```
