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
        try {
            output.appendLine(`Command invoked. uri: ${uri ? uri.fsPath : 'undefined'}`);

            const targetUri = getTargetUri(uri, selectedUris);
            if (!targetUri || targetUri.scheme !== 'file') {
                notifyFailure('Copy to Desktop: please select a file or folder in the explorer.', output);
                output.appendLine('No valid file or folder URI provided.');
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Copy to Desktop',
                    cancellable: false
                },
                async (progress) => {
                    const message = `Copy to Desktop: copying ${path.basename(targetUri.fsPath)}...`;
                    vscode.window.setStatusBarMessage(message, 5000);
                    progress.report({ message });
                    await copyResourceToDesktop(targetUri, output);
                }
            );
        } catch (err) {
            notifyFailure(`Copy to Desktop failed: ${err.message}`, output);
            output.appendLine(`Unexpected error: ${err.stack || err.message}`);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(output);
}

function getTargetUri(uri, selectedUris) {
    // VS Code can pass the URI as the first argument, or as part of a selection array.
    if (uri) {
        return uri;
    }

    if (selectedUris && selectedUris[0]) {
        return selectedUris[0];
    }

    // Fall back to the active text editor if the command was run from the palette.
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document && activeEditor.document.uri) {
        return activeEditor.document.uri;
    }

    return undefined;
}

async function copyResourceToDesktop(uri, output) {
    const sourcePath = uri.fsPath;
    output.appendLine(`Source: ${sourcePath}`);

    let stat;
    try {
        stat = await fs.promises.stat(sourcePath);
        if (!stat.isFile() && !stat.isDirectory()) {
            notifyFailure('Copy to Desktop: only files and folders are supported.', output);
            output.appendLine('Selection is not a file or folder.');
            return;
        }
    } catch (err) {
        notifyFailure(`Copy to Desktop: cannot read selection. ${err.message}`, output);
        output.appendLine(`Stat error: ${err.message}`);
        return;
    }

    const desktopPath = path.join(os.homedir(), 'Desktop');
    const isDirectory = stat.isDirectory();
    const resourceType = isDirectory ? 'folder' : 'file';
    const destPath = getUniqueDesktopPath(sourcePath, desktopPath, isDirectory);

    if (isDirectory && isSubpath(destPath, sourcePath)) {
        notifyFailure('Copy to Desktop: cannot copy a folder into itself.', output);
        output.appendLine(`Destination is inside source folder: ${destPath}`);
        return;
    }

    try {
        if (isDirectory) {
            await copyDirectory(sourcePath, destPath);
        } else {
            await fs.promises.copyFile(sourcePath, destPath);
        }

        const message = `Copied ${resourceType} to Desktop: ${path.basename(destPath)}`;
        notifySuccess(message, output);
        output.appendLine(`Success: ${destPath}`);
    } catch (err) {
        notifyFailure(`Copy to Desktop failed: ${err.message}`, output);
        output.appendLine(`Copy error: ${err.message}`);
    }
}

function notifySuccess(message, output) {
    vscode.window.setStatusBarMessage(message, 5000);
    vscode.window.showInformationMessage(message, 'Show Log').then((action) => {
        if (action === 'Show Log') {
            output.show(true);
        }
    });
}

function notifyFailure(message, output) {
    vscode.window.setStatusBarMessage(message, 8000);
    vscode.window.showErrorMessage(message, 'Show Log').then((action) => {
        if (action === 'Show Log') {
            output.show(true);
        }
    });
}

function getUniqueDesktopPath(sourcePath, desktopPath, isDirectory) {
    const baseName = path.basename(sourcePath);
    let destPath = path.join(desktopPath, baseName);

    if (!fs.existsSync(destPath)) {
        return destPath;
    }

    const ext = isDirectory ? '' : path.extname(baseName);
    const name = isDirectory ? baseName : path.basename(baseName, ext);
    let counter = 1;

    do {
        destPath = path.join(desktopPath, `${name} (${counter})${ext}`);
        counter++;
    } while (fs.existsSync(destPath));

    return destPath;
}

function isSubpath(childPath, parentPath) {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

async function copyDirectory(sourcePath, destPath) {
    const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });

    await fs.promises.mkdir(destPath);

    for (const entry of entries) {
        const sourceEntryPath = path.join(sourcePath, entry.name);
        const destEntryPath = path.join(destPath, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(sourceEntryPath, destEntryPath);
        } else if (entry.isSymbolicLink()) {
            const linkTarget = await fs.promises.readlink(sourceEntryPath);
            await fs.promises.symlink(linkTarget, destEntryPath);
        } else if (entry.isFile()) {
            await fs.promises.copyFile(sourceEntryPath, destEntryPath);
        }
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
