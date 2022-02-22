import { resolveProperties, Logger, } from "ethers/lib/utils";
import { BigNumber } from "bignumber.js";
import { BigNumber as BigNumberEthers } from "ethers";
import { checkTransactionType, serializeTransaction } from './helpers/utils';
import { GLOBAL_VARS } from './helpers/global-vars';
import { IntermediateWallet } from './helpers/IntermediateWallet';
import { computeAddress } from "./helpers/utils";
import { defineReadOnly } from "@ethersproject/properties";
import { decryptJsonWallet, decryptJsonWalletSync } from "@ethersproject/json-wallets";
import { HDNode, entropyToMnemonic } from "@ethersproject/hdnode";
import { arrayify, concat, hexDataSlice } from "@ethersproject/bytes";
import { randomBytes } from "@ethersproject/random";
import { keccak256 } from "@ethersproject/keccak256";
const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];
// Qtum core wallet and electrum use coin 88
export const QTUM_BIP44_PATH = "m/44'/88'/0'/0/0";
// Other wallets use coin 2301
// for more details, see: https://github.com/satoshilabs/slips/pull/196
export const SLIP_BIP44_PATH = "m/44'/2301'/0'/0/0";
export const defaultPath = SLIP_BIP44_PATH;
export class QtumWallet extends IntermediateWallet {
    constructor(privateKey, provider) {
        super(privateKey, provider);
    }
    async serializeTransaction(utxos, neededAmount, tx, transactionType) {
        return await serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.compressedPublicKey);
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
        let gasPrice = new BigNumber(BigNumberEthers.from(transaction.gasPrice).toString() + 'e-9');
        transaction.gasPrice = gasPrice.toNumber();
        const tx = await resolveProperties(transaction);
        // Refactored to check TX type (call, create, p2pkh, deploy error) and calculate needed amount
        const { transactionType, neededAmount } = checkTransactionType(tx);
        // Check if the transactionType matches the DEPLOY_ERROR, throw error else continue
        if (transactionType === GLOBAL_VARS.DEPLOY_ERROR) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", Logger.errors.NOT_IMPLEMENTED, {
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
            return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
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
        let entropy = randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return QtumWallet.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new QtumWallet(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new QtumWallet(decryptJsonWalletSync(json, password));
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
            path = defaultPath;
        }
        const hdnode = HDNode.fromMnemonic(mnemonic, "", wordlist).derivePath(path);
        // QTUM computes address from the public key differently than ethereum, ethereum uses keccak256 while QTUM uses ripemd160(sha256(compressedPublicKey))
        // @ts-ignore
        defineReadOnly(hdnode, "qtumAddress", computeAddress(hdnode.publicKey, true));
        return new QtumWallet(hdnode);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0gsaUJBQWlCLEVBQ2pCLE1BQU0sR0FDVCxNQUFNLGtCQUFrQixDQUFDO0FBRTFCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFDeEMsT0FBTyxFQUFFLFNBQVMsSUFBSSxlQUFlLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLE1BQU0saUJBQWlCLENBQUE7QUFDNUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVCQUF1QixDQUFBO0FBQ25ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDhCQUE4QixDQUFBO0FBQ2pFLE9BQU8sRUFBRSxjQUFjLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQTtBQUMvQyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHFCQUFxQixFQUFvQixNQUFNLDZCQUE2QixDQUFDO0FBQ3pHLE9BQU8sRUFBRSxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFTLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUM3RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDcEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBR3JELE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFFRiw0Q0FBNEM7QUFDNUMsTUFBTSxD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