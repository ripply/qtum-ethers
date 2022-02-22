"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumWallet = exports.defaultPath = exports.SLIP_BIP44_PATH = exports.QTUM_BIP44_PATH = void 0;
const utils_1 = require("ethers/lib/utils");
const bignumber_js_1 = require("bignumber.js");
const ethers_1 = require("ethers");
const utils_2 = require("./helpers/utils");
const global_vars_1 = require("./helpers/global-vars");
const IntermediateWallet_1 = require("./helpers/IntermediateWallet");
const utils_3 = require("./helpers/utils");
const properties_1 = require("@ethersproject/properties");
const json_wallets_1 = require("@ethersproject/json-wallets");
const hdnode_1 = require("@ethersproject/hdnode");
const bytes_1 = require("@ethersproject/bytes");
const random_1 = require("@ethersproject/random");
const keccak256_1 = require("@ethersproject/keccak256");
const logger = new utils_1.Logger("QtumWallet");
const forwardErrors = [
    utils_1.Logger.errors.INSUFFICIENT_FUNDS
];
// Qtum core wallet and electrum use coin 88
exports.QTUM_BIP44_PATH = "m/44'/88'/0'/0/0";
// Other wallets use coin 2301
// for more details, see: https://github.com/satoshilabs/slips/pull/196
exports.SLIP_BIP44_PATH = "m/44'/2301'/0'/0/0";
exports.defaultPath = exports.SLIP_BIP44_PATH;
class QtumWallet extends IntermediateWallet_1.IntermediateWallet {
    constructor(privateKey, provider) {
        super(privateKey, provider);
    }
    async serializeTransaction(utxos, neededAmount, tx, transactionType) {
        return await utils_2.serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.compressedPublicKey);
    }
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction) {
        if (!transaction.gasPrice) {
            // 40 satoshi in WEI
            // 40 => 40000000000
            transaction.gasPrice = "0x9502f9000";
        }
        // convert gasPrice into satoshi
        let gasPrice = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(transaction.gasPrice).toString() + 'e-9');
        transaction.gasPrice = gasPrice.toNumber();
        const tx = await utils_1.resolveProperties(transaction);
        // Refactored to check TX type (call, create, p2pkh, deploy error) and calculate needed amount
        const { transactionType, neededAmount } = utils_2.checkTransactionType(tx);
        // Check if the transactionType matches the DEPLOY_ERROR, throw error else continue
        if (transactionType === global_vars_1.GLOBAL_VARS.DEPLOY_ERROR) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
            });
        }
        let utxos = [];
        try {
            // @ts-ignore
            utxos = await this.provider.getUtxos(tx.from, neededAmount);
            // Grab vins for transaction object.
        }
        catch (error) {
            if (forwardErrors.indexOf(error.code) >= 0) {
                throw error;
            }
            return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                error: error,
            });
        }
        return await this.serializeTransaction(utxos, neededAmount, tx, transactionType);
    }
    connect(provider) {
        return new QtumWallet(this, provider);
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
        return QtumWallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return json_wallets_1.decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new QtumWallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new QtumWallet(json_wallets_1.decryptJsonWalletSync(json, password));
    }
    /**
     * Create a QtumWallet from a BIP44 mnemonic
     * @param mnemonic
     * @param path QTUM uses two different derivation paths and recommends SLIP_BIP44_PATH for external wallets, core wallets use QTUM_BIP44_PATH
     * @param wordlist
     * @returns
     */
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = exports.defaultPath;
        }
        const hdnode = hdnode_1.HDNode.fromMnemonic(mnemonic, "", wordlist).derivePath(path);
        // QTUM computes address from the public key differently than ethereum, ethereum uses keccak256 while QTUM uses ripemd160(sha256(compressedPublicKey))
        // @ts-ignore
        properties_1.defineReadOnly(hdnode, "qtumAddress", utils_3.computeAddress(hdnode.publicKey, true));
        return new QtumWallet(hdnode);
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw0Q0FHMEI7QUFFMUIsK0NBQXdDO0FBQ3hDLG1DQUFzRDtBQUN0RCwyQ0FBNEU7QUFDNUUsdURBQW1EO0FBQ25ELHFFQUFpRTtBQUNqRSwyQ0FBK0M7QUFDL0MsMERBQTJEO0FBQzNELDhEQUF5RztBQUN6RyxrREFBa0U7QUFDbEUsZ0RBQTZFO0FBQzdFLGtEQUFvRDtBQUNwRCx3REFBcUQ7QUFHckQsTUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDeEMsTUFBTSxhQUFhLEdBQUc7SUFDbEIsY0FBTSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0I7Q0FDbkMsQ0FBQztBQUVGLDRDQUE0QztBQUMvQixRQUFBLGVBQWUsR0FBRyxrQkFBa0IsQ0FBQztBQUNsRCw4QkFBOEI7QUFDOUIsdUVBQXVFO0FBQzFELFFBQUEsZUFBZSxHQUFHLG9CQUFvQixDQUFDO0FBQ3ZDLFFBQUEsV0FBVyxHQUFHLHVCQUFlLENBQUM7QUFFM0MsTUFBYSxVQUFXLFNBQVEsdUNBQWtCO0lBRTlDLFlBQVksVUFBZSxFQUFFLFFBQWM7UUFDdkMsS0FBSyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRVMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQWlCLEVBQUUsWUFBb0IsRUFBRSxFQUFzQixFQUFFLGVBQXVCO1FBQ3pILE9BQU8sTUFBTSw0QkFBb0IsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUMzSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZUFBZSxDQUFDLFdBQStCO1FBQ2pELElBQUksQ0FBQyxX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