# Publishing Guide for Zerox N8N Node

This guide provides step-by-step instructions for publishing and distributing the Zerox N8N node. Follow these steps to prepare your node for release, publish it to npm, and make it available to the N8N community.

## Preparing for Release

### Version Management

1. Update the version number in `package.json` according to semantic versioning:

   - **Major version**: Breaking changes
   - **Minor version**: New features without breaking changes
   - **Patch version**: Bug fixes and minor improvements

2. Update the changelog in `CHANGELOG.md` with details about the new version:

   ```markdown
   ## [1.0.0] - YYYY-MM-DD

   ### Added

   - Initial release of Zerox N8N node
   - Support for multiple model providers
   - Advanced document extraction options
   ```

### Pre-release Checklist

1. Ensure all code is properly formatted:

   ```bash
   npm run format
   ```

2. Run linting to check for code quality issues:

   ```bash
   npm run lint
   ```

3. Fix any linting issues:

   ```bash
   npm run lintfix
   ```

4. Build the project to ensure it compiles without errors:

   ```bash
   npm run build
   ```

5. Test the node in an N8N instance to verify functionality

## Publishing to npm

### First-time Setup

1. Create an npm account if you don't have one:

   ```bash
   npm adduser
   ```

2. Log in to your npm account:
   ```bash
   npm login
   ```

### Publishing Process

1. Prepare the package for publishing:

   ```bash
   npm run prepublishOnly
   ```

2. Publish the package to npm:

   ```bash
   npm publish
   ```

   For scoped packages (e.g., @getomni-ai/n8n-nodes-zerox):

   ```bash
   npm publish --access public
   ```

3. Verify the package is published:
   ```bash
   npm view n8n-nodes-zerox
   ```

## Publishing to N8N Community Nodes

### Submitting to N8N Community Nodes

1. Ensure your repository is public on GitHub

2. Add the `n8n-community-node-package` keyword in your `package.json`

3. Submit your node to the [N8N Community Nodes Repository](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base)

4. Follow the N8N team's guidelines for community node submissions

### Documentation for N8N Community

1. Create a clear README.md with:

   - Node description and capabilities
   - Installation instructions
   - Configuration details
   - Usage examples with screenshots
   - Troubleshooting tips

2. Provide example workflows that demonstrate the node's functionality

## Distribution via GitHub

### Creating a GitHub Release

1. Tag the release in Git:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. Create a release on GitHub:
   - Go to the repository's Releases page
   - Click "Create a new release"
   - Select the tag you created
   - Add release notes
   - Attach the built package as an asset

### GitHub Package Registry (Optional)

1. Configure npm to use GitHub Packages:

   ```bash
   npm config set @getomni-ai:registry https://npm.pkg.github.com
   ```

2. Update package.json with the GitHub registry:

   ```json
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

3. Publish to GitHub Packages:
   ```bash
   npm publish
   ```

## Maintaining the Package

### Handling Updates

1. Make code changes and test thoroughly

2. Update version number in package.json

3. Update changelog

4. Build and publish the new version:
   ```bash
   npm run build
   npm publish
   ```

### Deprecating Versions

If needed, deprecate a version:

```bash
npm deprecate n8n-nodes-zerox@"1.0.0" "Critical bug found, please update to 1.0.1"
```

## Integration with Zerox Repository

Since this node is part of the Zerox repository, follow these additional steps:

1. Create a pull request to the main Zerox repository with your changes

2. Ensure the node-zerox-n8n directory is properly integrated with the main repository structure

3. Update the main Zerox README.md to mention the N8N integration

4. Coordinate version releases with the main Zerox package to ensure compatibility

## Troubleshooting Publishing Issues

### npm Publishing Issues

- **Error: You do not have permission to publish**: Ensure you're logged in to the correct npm account and have publishing rights
- **Error: Package name already exists**: Choose a different package name or use a scoped package
- **Error: Version already exists**: Update the version number in package.json

### GitHub Issues

- **Error: Authentication failed**: Ensure you have the correct GitHub token with package publishing permissions
- **Error: Failed to push tag**: Pull the latest changes and try again

## Post-Publication

1. Announce the release on relevant channels
2. Monitor issues and feedback from users
3. Provide support and documentation updates as needed
4. Plan for future improvements based on user feedback
