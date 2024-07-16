# setup-github-token action

## Complete example usage

jobs: release: name: Release runs-on: ubuntu-latest permissions: id-token: write
contents: read steps: - name: Setup GitHub Token id: setup-github-token uses:
smartcontractkit/.github/actions/setup-github-token@<commit> #
setup-github-token@x.y.z with: aws-role-arn:
${{ secrets.AWS_ROLE_ARN_GATI_CHANGESETS }} aws-lambda-url:
${{ secrets.GATI_LAMBDA_FUNCTION_URL }} aws-region: ${{ secrets.AWS_REGION }}
aws-role-duration-seconds: "1800"

      - name: Echo GATI token
        shell: bash
        run: echo ${{ steps.setup-github-token.outputs.access-token }} | shasum

      - name: Revoke GitHub Token
        id: revoke-github-token
        uses: smartcontractkit/.github/actions/setup-github-token@<commit> # setup-github-token@x.y.z
        with:
          aws-role-arn: ${{ secrets.AWS_ROLE_ARN_GATI_CHANGESETS }}
          aws-lambda-url: ${{ secrets.GATI_LAMBDA_FUNCTION_URL }}
          aws-region: ${{ secrets.AWS_REGION }}
          revoke-token: ${{ steps.setup-github-token.outputs.access-token }}
