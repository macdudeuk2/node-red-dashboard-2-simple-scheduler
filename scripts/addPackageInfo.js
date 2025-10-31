const fs = require('fs')
const path = require('path')

// Get command line arguments
const packageJsonPath = process.argv[2] || './package.json'
const targetFilePath = process.argv[3] || './nodes/ui-scheduler.js'

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// Read target file
let targetFileContent = fs.readFileSync(targetFilePath, 'utf8')

// Replace or add version and package name at the top of the file
const versionLine = `const version = '${packageJson.version}'`
const packageNameLine = `const packageName = '${packageJson.name}'`

// Check if version line already exists
if (targetFileContent.includes('const version =')) {
  targetFileContent = targetFileContent.replace(/const version = ['"].*?['"]/, versionLine)
} else {
  targetFileContent = versionLine + '\n' + targetFileContent
}

// Check if packageName line already exists
if (targetFileContent.includes('const packageName =')) {
  targetFileContent = targetFileContent.replace(/const packageName = ['"].*?['"]/, packageNameLine)
} else {
  // Add after version line
  targetFileContent = targetFileContent.replace(versionLine, versionLine + '\n' + packageNameLine)
}

// Write back to target file
fs.writeFileSync(targetFilePath, targetFileContent)

console.log(`Version ${packageJson.version} and package name ${packageJson.name} have been added/updated in ${targetFilePath}`)

