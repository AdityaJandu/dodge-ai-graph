import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DATA_DIR = path.join(process.cwd(), 'data');

async function inspectData() {
    console.log("🔍 Scanning Enterprise Data Schema...\n");

    // Get all directories inside /data
    const folders = fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const folder of folders) {
        const folderPath = path.join(DATA_DIR, folder);
        // Find the first .jsonl file in the folder
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));

        if (files.length === 0) continue;

        const firstFile = files[0];
        const fileStream = fs.createReadStream(path.join(folderPath, firstFile));
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (line.trim()) {
                console.log(`=========================================`);
                console.log(`📂 FOLDER: ${folder}`);
                console.log(`=========================================`);

                try {
                    const parsed: Record<string, unknown> = JSON.parse(line);
                    // Print the keys and the first value so we can see the data types
                    const schema = Object.keys(parsed).reduce((acc, key) => {
                        acc[key] = parsed[key];
                        return acc;
                    }, {} as Record<string, unknown>);

                    console.log(schema);
                } catch (e) {
                    console.log("❌ Error parsing JSON on line 1.");
                    console.error(e);
                }

                console.log("\n");
                break; // Stop after the first line, move to the next folder
            }
        }
    }
    console.log("✅ Schema scan complete.");
}

inspectData().catch(console.error);