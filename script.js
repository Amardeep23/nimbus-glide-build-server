const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
require('dotenv').config()


const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


const PROJECT_ID = process.env.PROJECT_ID;


async function init() {
  console.log("Executing script.js");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
  });

  p.stderr.on("data", function (data) {
    console.log("Error", data.toString());
  });

  p.on("close", async function () {
    console.log("Build Complete");
    const buildFolderPath = path.join(outDirPath, "build");

    if (!fs.existsSync(buildFolderPath)) {
      console.error(`Directory not found: ${buildFolderPath}`);
      return;
    }

    async function uploadDirectory(directoryPath, s3Prefix) {
      const items = fs.readdirSync(directoryPath, { withFileTypes: true });
      
      
      for (const item of items) {
        const itemPath = path.join(directoryPath, item.name);
        const s3Key = path.join(s3Prefix, item.name).replace(/\\/g, '/');

        if (item.isDirectory()) {
          await uploadDirectory(itemPath, s3Key);
        } else {
          if (itemPath.startsWith(buildFolderPath)) {
            console.log("Uploading", itemPath);
            const command = new PutObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: s3Key,
              Body: fs.createReadStream(itemPath),
              ContentType: mime.lookup(itemPath),
            });

            try {
              await s3Client.send(command);
              console.log("Uploaded", itemPath);
            } catch (err) {
              console.error(`Failed to upload ${itemPath}:`, err);
            }
          }
        }
      }
    }

    await uploadDirectory(buildFolderPath, `__outputs/${PROJECT_ID}`);

    console.log("Done...");
  });
}

init();
