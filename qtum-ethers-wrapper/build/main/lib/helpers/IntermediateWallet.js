"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTypedData = exports.verifyMessage = exports.IntermediateWallet = exports.version = void 0;
const address_1 = require("@ethersproject/address");
const abstract_provider_1 = require("@ethersproject/abstract-provider");
const abstract_signer_1 = require("@ethersproject/abstract-signer");
const bytes_1 = require("@ethersproject/bytes");
const hash_1 = require("@ethersproject/hash");
const hdnode_1 = require("@ethersproject/hdnode");
const keccak256_1 = require("@ethersproject/keccak256");
const properties_1 = require("@ethersproject/properties");
const random_1 = require("@ethersproject/random");
const signing_key_1 = require("@ethersproject/signing-key");
const json_wallets_1 = require("@ethersproject/json-wallets");
const transactions_1 = require("@ethersproject/transactions");
const utils_1 = require("./utils");
const logger_1 = require("@ethersproject/logger");
exports.version = "wallet/5.1.0";
const logger = new logger_1.Logger(exports.version);
function isAccount(value) {
    return (value != null && bytes_1.isHexString(value.privateKey, 32) && value.address != null);
}
function hasMnemonic(value) {
    const mnemonic = value.mnemonic;
    return (mnemonic && mnemonic.phrase);
}
// Created this class due to address being read only and unwriteable from derived classes.
class IntermediateWallet extends abstract_signer_1.Signer {
    constructor(privateKey, provider) {
        logger.checkNew(new.target, IntermediateWallet);
        super();
        if (isAccount(privateKey)) {
            const signingKey = new signing_key_1.SigningKey(privateKey.privateKey);
            properties_1.defineReadOnly(this, "_signingKey", () => signingKey);
            properties_1.defineReadOnly(this, "address", utils_1.computeAddress(this.publicKey));
            if (this.address !== address_1.getAddress(privateKey.address)) {
                logger.throwArgumentError("privateKey/address mismatch", "privateKey", "[REDACTED]");
            }
            if (hasMnemonic(privateKey)) {
                const srcMnemonic = privateKey.mnemonic;
                properties_1.defineReadOnly(this, "_mnemonic", () => ({
                    phrase: srcMnemonic.phrase,
                    path: srcMnemonic.path || hdnode_1.defaultPath,
                    locale: srcMnemonic.locale || "en"
                }));
                const mnemonic = this.mnemonic;
                const node = hdnode_1.HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path);
                if (utils_1.computeAddress(node.privateKey) !== this.address) {
                    logger.throwArgumentError("mnemonic/address mismatch", "privateKey", "[REDACTED]");
                }
            }
            else {
                properties_1.defineReadOnly(this, "_mnemonic", () => null);
            }
        }
        else {
            if (signing_key_1.SigningKey.isSigningKey(privateKey)) {
                /* istanbul ignore if */
                if (privateKey.curve !== "secp256k1") {
                    logger.throwArgumentError("unsupported curve; must be secp256k1", "privateKey", "[REDACTED]");
                }
                properties_1.defineReadOnly(this, "_signingKey", () => privateKey);
            }
            else {
                // A lot of common tools do not prefix private keys with a 0x (see: #1166)
                if (typeof (privateKey) === "string") {
                    if (privateKey.match(/^[0-9a-f]*$/i) && privateKey.length === 64) {
                        privateKey = "0x" + privateKey;
                    }
                }
                const signingKey = new signing_key_1.SigningKey(privateKey);
                properties_1.defineReadOnly(this, "_signingKey", () => signingKey);
            }
            properties_1.defineReadOnly(this, "_mnemonic", () => null);
            properties_1.defineReadOnly(this, "address", utils_1.computeAddress(this.publicKey));
        }
        /* istanbul ignore if */
        if (provider && !abstract_provider_1.Provider.isProvider(provider)) {
            logger.throwArgumentError("invalid provider", "provider", provider);
        }
        properties_1.defineReadOnly(this, "provider", provider || null);
    }
    get mnemonic() { return this._mnemonic(); }
    get privateKey() { return this._signingKey().privateKey; }
    get publicKey() { return this._signingKey().publicKey; }
    getAddress() {
        return Promise.resolve(this.address);
    }
    connect(provider) {
        return new IntermediateWallet(this, provider);
    }
    signTransaction(transaction) {
        return properties_1.resolveProperties(transaction).then((tx) => {
            if (tx.from != null) {
                if (address_1.getAddress(tx.from) !== this.address) {
                    logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }
            const signature = this._signingKey().signDigest(keccak256_1.keccak256(transactions_1.serialize(tx)));
            return transactions_1.serialize(tx, signature);
        });
    }
    async signMessage(message) {
        return bytes_1.joinSignature(this._signingKey().signDigest(hash_1.hashMessage(message)));
    }
    async _signTypedData(domain, types, value) {
        // Populate any ENS names
        const populated = await hash_1._TypedDataEncoder.resolveNames(domain, types, value, (name) => {
            if (this.provider == null) {
                logger.throwError("cannot resolve ENS names without a provider", logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: "resolveName",
                    value: name
                });
            }
            return this.provider.resolveName(name);
        });
        return bytes_1.joinSignature(this._signingKey().signDigest(hash_1._TypedDataEncoder.hash(populated.domain, types, populated.value)));
    }
    encrypt(password, options, progressCallback) {
        if (typeof (options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }
        if (progressCallback && typeof (progressCallback) !== "function") {
            throw new Error("invalid callback");
        }
        if (!options) {
            options = {};
        }
        return json_wallets_1.encryptKeystore(this, password, options, progressCallback);
    }
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options) {
        let entropy = random_1.randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = bytes_1.arrayify(bytes_1.hexDataSlice(keccak256_1.keccak256(bytes_1.concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = hdnode_1.entropyToMnemonic(entropy, options.locale);
        return IntermediateWallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return json_wallets_1.decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new IntermediateWallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new IntermediateWallet(json_wallets_1.decryptJsonWalletSync(json, password));
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = hdnode_1.defaultPath;
        }
        return new IntermediateWallet(hdnode_1.HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}
exports.IntermediateWallet = IntermediateWallet;
function verifyMessage(message, signature) {
    return transactions_1.recoverAddress(hash_1.hashMessage(message), signature);
}
exports.verifyMessage = verifyMessage;
function verifyTypedData(domain, types, value, signature) {
    return transactions_1.recoverAddress(hash_1._TypedDataEncoder.hash(domain, types, value), signature);
}
exports.verifyTypedData = verifyTypedData;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJtZWRpYXRlV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9oZWxwZXJzL0ludGVybWVkaWF0ZVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxvREFBb0Q7QUFDcEQsd0VBQWdGO0FBQ2hGLG9FQUFrSTtBQUNsSSxnREFBbUk7QUFDbkksOENBQXFFO0FBQ3JFLGtEQUF5RjtBQUN6Rix3REFBcUQ7QUFDckQsMERBQThFO0FBQzlFLGtEQUFvRDtBQUNwRCw0REFBd0Q7QUFDeEQsOERBQTBIO0FBQzFILDhEQUE2RjtBQUU3RixtQ0FBdUM7QUFDdkMsa0RBQStDO0FBQ2xDLFFBQUEsT0FBTyxHQUFHLGNBQWMsQ0FBQztBQUN0QyxNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQU0sQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUVuQyxTQUFTLFNBQVMsQ0FBQyxLQUFVO0lBQ3pCLE9BQU8sQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLG1CQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDO0FBQ3pGLENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxLQUFVO0lBQzNCLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDaEMsT0FBTyxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUNELDBGQUEwRjtBQUMxRixNQUFhLGtCQUFtQixTQUFRLHdCQUFNO0lBVTFDLFlBQVksVUFBMkQsRUFBRSxRQUFtQjtRQUN4RixNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUVoRCxLQUFLLEVBQUUsQ0FBQztRQUVSLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3ZCLE1BQU0sVUFBVSxH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