const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('node:crypto');
const { UsageLog } = require('./usage');

const CHANNEL_NAME = 'Copy to Desktop';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const output = vscode.window.createOutputChannel(CHANNEL_NAME);
    const usage = new UsageLog(path.join(context.globalStorageUri.fsPath, 'logs'), context.extension.packageJSON.version, output);
    usage.event('activation', 'success');

    const disposable = vscode.commands.registerCommand('copyToDesktop.copy', async (uri, selectedUris) => {
        const operationId = randomUUID();
        const started = performance.now();
        const stats = { files: 0, bytes: 0, links: 0, collisions: 0 };
        usage.event('copy', 'started', { source: uri ? 'context' : selectedUris?.length ? 'selection' : 'palette', selected_count: selectedUris?.length || (uri ? 1 : 0) }, operationId);
        try {

            const targetUri = getTargetUri(uri, selectedUris);
            if (!targetUri || targetUri.scheme !== 'file') {
                notifyFailure('Copy to Desktop: please select a file or folder in the explorer.', output);
                await usage.event('copy', 'blocked', { error_code: 'invalid_selection' }, operationId, Math.round(performance.now() - started));
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
                    const result = await copyResourceToDesktop(targetUri, output, stats);
                    await usage.event('copy', result, stats, operationId, Math.round(performance.now() - started));
                }
            );
        } catch (err) {
            notifyFailure(`Copy to Desktop failed: ${err.message}`, output);
            await usage.event('copy', stats.files || stats.links ? 'partial' : 'error', { ...stats, error_code: safeError(err) }, operationId, Math.round(performance.now() - started));
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

async function copyResourceToDesktop(uri, output, stats) {
    const sourcePath = uri.fsPath;


    let stat;
    try {
        stat = await fs.promises.stat(sourcePath);
        if (!stat.isFile() && !stat.isDirectory()) {
            notifyFailure('Copy to Desktop: only files and folders are supported.', output);
            stats.error_code = 'unsupported_type';
            return 'blocked';
        }
    } catch (err) {
        notifyFailure(`Copy to Desktop: cannot read selection. ${err.message}`, output);
        stats.error_code = safeError(err);
        return 'error';
    }

    const desktopPath = path.join(os.homedir(), 'Desktop');
    const isDirectory = stat.isDirectory();
    const resourceType = isDirectory ? 'folder' : 'file';
    stats.type = resourceType;
    const destPath = getUniqueDesktopPath(sourcePath, desktopPath, isDirectory, stats);

    if (isDirectory && isSubpath(destPath, sourcePath)) {
        notifyFailure('Copy to Desktop: cannot copy a folder into itself.', output);
        stats.error_code = 'recursive_destination';
        return 'blocked';
    }

    try {
        if (isDirectory) {
            await copyDirectory(sourcePath, destPath, stats);
        } else {
            await fs.promises.copyFile(sourcePath, destPath);
            stats.files++; stats.bytes += stat.size;
        }

        const message = `Copied ${resourceType} to Desktop: ${path.basename(destPath)}`;
        notifySuccess(message, output);
        return 'success';
    } catch (err) {
        notifyFailure(`Copy to Desktop failed: ${err.message}`, output);
        stats.error_code = safeError(err);
        return stats.files || stats.links ? 'partial' : 'error';
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

function getUniqueDesktopPath(sourcePath, desktopPath, isDirectory, stats) {
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
        stats.collisions++;
    } while (fs.existsSync(destPath));

    return destPath;
}

function isSubpath(childPath, parentPath) {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

async function copyDirectory(sourcePath, destPath, stats) {
    const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });

    await fs.promises.mkdir(destPath);

    for (const entry of entries) {
        const sourceEntryPath = path.join(sourcePath, entry.name);
        const destEntryPath = path.join(destPath, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(sourceEntryPath, destEntryPath, stats);
        } else if (entry.isSymbolicLink()) {
            const linkTarget = await fs.promises.readlink(sourceEntryPath);
            await fs.promises.symlink(linkTarget, destEntryPath);
            stats.links++;
        } else if (entry.isFile()) {
            await fs.promises.copyFile(sourceEntryPath, destEntryPath);
            stats.files++; stats.bytes += (await fs.promises.stat(destEntryPath)).size;
        }
    }
}

function safeError(error) {
    return ['EACCES','EPERM','ENOENT','ENOSPC','EEXIST','EIO','ENOTDIR'].includes(error.code) ? error.code : 'copy_failed';
}
function deactivate() {}

module.exports = {
    activate,
    deactivate
};
