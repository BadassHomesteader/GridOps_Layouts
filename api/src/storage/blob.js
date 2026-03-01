const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

// Container name for GridOps Layouts data
const CONTAINER = 'gridops-layouts-data';

// Lazy-initialize blob service client
let _blobServiceClient = null;

function getBlobServiceClient() {
    if (!_blobServiceClient) {
        const cs = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
        if (!cs) {
            throw new Error('Missing STORAGE_CONNECTION_STRING or AzureWebJobsStorage env var');
        }
        _blobServiceClient = BlobServiceClient.fromConnectionString(cs);
    }
    return _blobServiceClient;
}

// Development fallback: path to local data directory
// From api/src/storage → go up 3 levels to GridOps_Layouts root
const LOCAL_DATA_PATH = path.resolve(__dirname, '../../..');

// Helper: convert readable stream to string
async function streamToString(readableStream) {
    readableStream.setEncoding('utf8');
    let data = '';
    for await (const chunk of readableStream) {
        data += chunk;
    }
    return data;
}

// Check if we're using local development storage
const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '';
const USE_LOCAL_STORAGE = connStr === 'UseDevelopmentStorage=true';

/**
 * Read and parse JSON from blob storage
 * Uses local filesystem in development
 */
async function readJSON(containerName, blobName) {
    if (USE_LOCAL_STORAGE) {
        const localPath = path.join(LOCAL_DATA_PATH, containerName, blobName);
        try {
            const content = fs.readFileSync(localPath, 'utf8');
            console.log(`[DEV] Read from local: ${localPath}`);
            return JSON.parse(content);
        } catch (fsError) {
            if (fsError.code === 'ENOENT') return null;
            throw fsError;
        }
    }

    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
        const downloadResponse = await blockBlobClient.download(0);
        const downloadedContent = await streamToString(downloadResponse.readableStreamBody);
        return JSON.parse(downloadedContent);
    } catch (error) {
        if (error.statusCode === 404) return null;
        throw error;
    }
}

/**
 * Write JSON data to blob storage
 * Uses local filesystem in development
 */
async function writeJSON(containerName, blobName, data) {
    const content = JSON.stringify(data, null, 2);

    if (USE_LOCAL_STORAGE) {
        const localPath = path.join(LOCAL_DATA_PATH, containerName, blobName);
        const dir = path.dirname(localPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(localPath, content, 'utf8');
        console.log(`[DEV] Wrote to local: ${localPath}`);
        return;
    }

    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
        overwrite: true,
        blobHTTPHeaders: { blobContentType: 'application/json' }
    });
}

/**
 * List all JSON files in a container directory
 * Uses local filesystem in development
 */
async function listJSON(containerName, prefix) {
    if (USE_LOCAL_STORAGE) {
        const localDir = path.join(LOCAL_DATA_PATH, containerName, prefix);
        try {
            const files = fs.readdirSync(localDir);
            const jsonFiles = files
                .filter(f => f.endsWith('.json'))
                .map(f => `${prefix}${f}`);
            console.log(`[DEV] Listed ${jsonFiles.length} files from: ${localDir}`);
            return jsonFiles;
        } catch (fsError) {
            if (fsError.code === 'ENOENT') return [];
            throw fsError;
        }
    }

    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blobs = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (blob.name.endsWith('.json')) {
            blobs.push(blob.name);
        }
    }

    return blobs;
}

/**
 * Read multiple JSON blobs in parallel batches
 */
async function readBatchJSON(containerName, blobNames, concurrency = 20) {
    const results = [];
    for (let i = 0; i < blobNames.length; i += concurrency) {
        const batch = blobNames.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(name => readJSON(containerName, name))
        );
        results.push(...batchResults);
    }
    return results.filter(item => item !== null);
}

/**
 * Delete a blob from storage
 * Uses local filesystem in development
 */
async function deleteBlob(containerName, blobName) {
    if (USE_LOCAL_STORAGE) {
        const localPath = path.join(LOCAL_DATA_PATH, containerName, blobName);
        try {
            fs.unlinkSync(localPath);
            console.log(`[DEV] Deleted from local: ${localPath}`);
            return true;
        } catch (fsError) {
            if (fsError.code === 'ENOENT') return false;
            throw fsError;
        }
    }

    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
        await blockBlobClient.delete();
        return true;
    } catch (error) {
        if (error.statusCode === 404) return false;
        throw error;
    }
}

module.exports = {
    readJSON,
    writeJSON,
    listJSON,
    readBatchJSON,
    deleteBlob,
    CONTAINER
};
