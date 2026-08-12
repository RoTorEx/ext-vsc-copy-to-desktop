const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHANNEL_NAME = 'Copy to Desktop';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const output = vscode.window.createOutputChannel(CHANNEL_NAME);
    output.appendLine(`Copy to Desktop extension activated. Version: ${context.extension.packageJSON.version}`);

    const disposable = vscode.commands.registerCommand('copyToDesktop.copy', async (uri, selectedUris) => {
        output.appendLine(`Command invoked. uri: ${uri ? uri.fsPath : 'undefined'}`);

        // VS Code can pass the URI as the first argument, or as part of a selection array.
        const targetUri = uri || (selectedUris && selectedUris[0]);

        if (!targetUri || targetUri.scheme !== 'file') {
            // Fall back to the active text editor if the command was run from the palette.
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document && activeEditor.document.uri && activeEditor.document.uri.scheme === 'file') {
                return copyFileToDesktop(activeEditor.document.uri, output);
            }

            vscode.window.showErrorMessage('Copy to Desktop: please select a file in the explorer.');
            output.appendLine('No valid file URI provided.');
            return;
        }

        await copyFileToDesktop(targetUri, output);
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(output);
}

async function copyFileToDesktop(uri, output) {
    const sourcePath = uri.fsPath;
    output.appendLine(`Source: ${sourcePath}`);

    try {
        const stat = await fs.promises.stat(sourcePath);
        if (!stat.isFile()) {
            vscode.window.showErrorMessage('Copy to Desktop: folders are not supported.');
            output.appendLine('Selection is not a file.');
            return;
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Copy to Desktop: cannot read file. ${err.message}`);
        output.appendLine(`Stat error: ${err.message}`);
        return;
    }

    const desktopPath = path.join(os.homedir(), 'Desktop');
    const baseName = path.basename(sourcePath);
    let destPath = path.join(desktopPath, baseName);

    // Avoid overwriting existing files by appending a counter.
    if (fs.existsSync(destPath)) {
        const ext = path.extname(baseName);
        const name = path.basename(baseName, ext);
        let counter = 1;
        do {
            destPath = path.join(desktopPath, `${name} (${counter})${ext}`);
            counter++;
        } while (fs.existsSync(destPath));
    }

    try {
        await fs.promises.copyFile(sourcePath, destPath);
        const message = `Copied to Desktop: ${path.basename(destPath)}`;
        vscode.window.showInformationMessage(message);
        output.appendLine(`Success: ${destPath}`);
    } catch (err) {
        vscode.window.showErrorMessage(`Copy to Desktop failed: ${err.message}`);
        output.appendLine(`Copy error: ${err.message}`);
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
