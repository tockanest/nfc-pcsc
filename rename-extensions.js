// Simple script to rename JS files to MJS files. This is useful to ESM support.

const fs = require("fs");
const path = require("path");

function renameExtensions(dir, fromExt, toExt) {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		if (fs.statSync(filePath).isDirectory()) {
			renameExtensions(filePath, fromExt, toExt);
		} else if (path.extname(file) === fromExt) {
			const renamedFilePath = path.join(
				dir,
				path.basename(file, fromExt) + toExt
			);
			fs.renameSync(filePath, renamedFilePath);
			console.log(`Renamed ${filePath} to ${renamedFilePath}`);
		}
	}
}

const args = process.argv.slice(2);
if (args.length !== 3) {
	console.log(
		"Usage: node rename-extensions.js <directory> <from_extension> <to_extension>"
	);
	process.exit(1);
}

const [dir, fromExt, toExt] = args;
renameExtensions(dir, fromExt, toExt);
