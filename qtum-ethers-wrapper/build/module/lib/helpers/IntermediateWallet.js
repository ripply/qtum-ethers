// @ts-nocheck
import { getAddress } from "@ethersproject/address";
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, concat, hexDataSlice, isHexString, joinSignature } from "@ethersproject/bytes";
import { hashMessage, _TypedDataEncoder } from "@ethersproject/hash";
import { defaultPath, HDNode, entropyToMnemonic } from "@ethersproject/hdnode";
import { keccak256 } from "@ethersproject/keccak256";
import { defineReadOnly, resolveProperties } from "@ethersproject/properties";
import { randomBytes } from "@ethersproject/random";
import { SigningKey } from "@ethersproject/signing-key";
import { decryptJsonWallet, decryptJsonWalletSync, encryptKeystore } from "@ethersproject/json-wallets";
import { recoverAddress, serialize } from "@ethersproject/transactions";
import { computeAddress } from "./utils";
import { Logger } from "@ethersproject/logger";
export const version = "wallet/5.1.0";
const logger = new Logger(version);
function isAccount(value) {
    return (value != null && isHexString(value.privateKey, 32) && value.address != null);
}
function hasMnemonic(value) {
    const mnemonic = value.mnemonic;
    return (mnemonic && mnemonic.phrase);
}
// Created this class due to address being read only and unwriteable from derived classes.
export class IntermediateWallet extends Signer {
    constructor(privateKey, provider) {
        super();
        if (isAccount(privateKey)) {
            const signingKey = new SigningKey(privateKey.privateKey);
            defineReadOnly(this, "_signingKey", () => signingKey);
            defineReadOnly(this, "address", computeAddress(this.publicKey));
            if (this.address !== getAddress(privateKey.address)) {
                logger.throwArgumentError("privateKey/address mismatch", "privateKey", "[REDACTED]");
            }
            if (hasMnemonic(privateKey)) {
                const srcMnemonic = privateKey.mnemonic;
                defineReadOnly(this, "_mnemonic", () => ({
                    phrase: srcMnemonic.phrase,
                    path: srcMnemonic.path || defaultPath,
                    locale: srcMnemonic.locale || "en"
                }));
                const mnemonic = this.mnemonic;
                const node = HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path);
                if (computeAddress(node.privateKey) !== this.address) {
                    logger.throwArgumentError("mnemonic/address mismatch", "privateKey", "[REDACTED]");
                }
            }
            else {
                defineReadOnly(this, "_mnemonic", () => null);
            }
        }
        else {
            if (SigningKey.isSigningKey(privateKey)) {
                /* istanbul ignore if */
                if (privateKey.curve !== "secp256k1") {
                    logger.throwArgumentError("unsupported curve; must be secp256k1", "privateKey", "[REDACTED]");
                }
                defineReadOnly(this, "_signingKey", () => privateKey);
            }
            else {
                // A lot of common tools do not prefix private keys with a 0x (see: #1166)
                if (typeof (privateKey) === "string") {
                    if (privateKey.match(/^[0-9a-f]*$/i) && privateKey.length === 64) {
                        privateKey = "0x" + privateKey;
                    }
                }
                const signingKey = new SigningKey(privateKey);
                defineReadOnly(this, "_signingKey", () => signingKey);
            }
            defineReadOnly(this, "_mnemonic", () => null);
            defineReadOnly(this, "address", computeAddress(this.publicKey));
        }
        /* istanbul ignore if */
        if (provider && !Provider.isProvider(provider)) {
            logger.throwArgumentError("invalid provider", "provider", provider);
        }
        defineReadOnly(this, "provider", provider || null);
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
        return resolveProperties(transaction).then((tx) => {
            if (tx.from != null) {
                if (getAddress(tx.from) !== this.address) {
                    logger.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }
            const signature = this._signingKey().signDigest(keccak256(serialize(tx)));
            return serialize(tx, signature);
        });
    }
    async signMessage(message) {
        return joinSignature(this._signingKey().signDigest(hashMessage(message)));
    }
    async _signTypedData(domain, types, value) {
        // Populate any ENS names
        const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name) => {
            if (this.provider == null) {
                logger.throwError("cannot resolve ENS names without a provider", Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: "resolveName",
                    value: name
                });
            }
            return this.provider.resolveName(name);
        });
        return joinSignature(this._signingKey().signDigest(_TypedDataEncoder.hash(populated.domain, types, populated.value)));
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
        return encryptKeystore(this, password, options, progressCallback);
    }
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options) {
        let entropy = randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return IntermediateWallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new IntermediateWallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new IntermediateWallet(decryptJsonWalletSync(json, password));
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = defaultPath;
        }
        return new IntermediateWallet(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}
export function verifyMessage(message, signature) {
    return recoverAddress(hashMessage(message), signature);
}
export function verifyTypedData(domain, types, value, signature) {
    return recoverAddress(_TypedDataEncoder.hash(domain, types, value), signature);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJtZWRpYXRlV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9oZWxwZXJzL0ludGVybWVkaWF0ZVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjO0FBQ2QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxRQUFRLEVBQXNCLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUEwQixNQUFNLEVBQW9ELE1BQU0sZ0NBQWdDLENBQUM7QUFDbEksT0FBTyxFQUFFLFFBQVEsRUFBb0IsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFpQixNQUFNLHNCQUFzQixDQUFDO0FBQ25JLE9BQU8sRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBWSxNQUFNLHVCQUF1QixDQUFDO0FBQ3pGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUscUJBQXFCLEVBQUUsZUFBZSxFQUFvQixNQUFNLDZCQUE2QixDQUFDO0FBQzFILE9BQU8sRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUF1QixNQUFNLDZCQUE2QixDQUFDO0FBRTdGLE9BQU8sRUFBRSxjQUFjLEVBQUMsTUFBTSxTQUFTLENBQUE7QUFDdkMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9DLE1BQU0sQ0FBQyxN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