const {
  StorageSharedKeyCredential,
  BlobServiceClient,
} = require("@azure/storage-blob");
const { AbortController } = require("@azure/abort-controller");
const core = require('@actions/core');
const github = require('@actions/github');

const fs = require("fs");

// if (process.env.NODE_ENV !== "production") {
//   require("dotenv").config();
// }

const STORAGE_ACCOUNT_NAME = core.getInput('storage_account_name');
const ACCOUNT_ACCESS_KEY = core.getInput('account_access_key');
const CONTAINER_NAME = core.getInput('container_name');
const BLOB_PREFIX = core.getInput('blob_prefix');
const OUTPUT_FILENAME = core.getInput('output_file');

const ONE_MINUTE = 60 * 1000;

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data.toString());
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });
}

async function main() {
  // setup sdk
  const credentials = new StorageSharedKeyCredential(
      STORAGE_ACCOUNT_NAME,
      ACCOUNT_ACCESS_KEY
  );
  const blobServiceClient = new BlobServiceClient(
      `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      credentials
  );

  // get container
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  console.log(`SUCCESS: Container "${CONTAINER_NAME}" retrieved`);

  // get blob name
  const iterator = containerClient.listBlobsFlat({ prefix: BLOB_PREFIX });
  const blobItem = (await iterator.next()).value;
  console.log(`SUCCESS: Blob "${blobItem.name}" found`);

  // get blob item
  const blobClient = containerClient.getBlobClient(blobItem.name);
  const blockBlobClient = blobClient.getBlockBlobClient();

  // download blob
  const aborter = AbortController.timeout(30 * ONE_MINUTE);
  const downloadResponse = await blockBlobClient.download(0, aborter);
  const downloadedContent = await streamToString(
      downloadResponse.readableStreamBody
  );
  console.log(`SUCCESS: Downloaded content: \n\n---\n\n${downloadedContent}\n\n---\n\n`);
  
  core.setOutput('success', downloadedContent)
  
  fs.writeFile(OUTPUT_FILENAME, downloadedContent, (err) => {
    if (err) throw err;
    console.log(`SUCCESS: Saved blob "${blobItem.name}" to "${OUTPUT_FILENAME}"`);
  });

}

main()
.then(() => console.log("SUCCESS: Done"))
.catch((error) => console.error(`ERROR: ${error.message}`));
