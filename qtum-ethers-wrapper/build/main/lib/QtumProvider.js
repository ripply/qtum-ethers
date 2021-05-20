"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumProvider = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("./helpers/utils");
class QtumProvider extends ethers_1.providers.JsonRpcProvider {
    constructor(url, network) {
        super(url, network);
    }
    /**
     * Override for QTUM parsing of transaction
     * https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/base-provider.ts
     */
    async sendTransaction(signedTransaction) {
        await this.getNetwork();
        const signedTx = await Promise.resolve(signedTransaction);
        const hexTx = `0x${signedTx}`;
        // Parse the signed transaction here
        const tx = utils_1.parseSignedTransaction(signedTx);
        try {
            const hash = await this.perform("sendTransaction", {
                signedTransaction: hexTx,
            });
            // Note: need to destructure return result here.
            return this._wrapTransaction(tx, ...hash);
        }
        catch (error) {
            error.transaction = tx;
            error.transactionHash = tx.hash;
            throw error;
        }
    }
    /**
     * Function to handle grabbing UTXO's from janus
     * prepareRequest in https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/json-rpc-provider.ts
     */
    async getUtxos(from, neededAmount) {
        await this.getNetwork();
        const params = [from, neededAmount];
        return await this.perform("qtum_qetUTXOs", params);
    }
    /**
     * Override to handle grabbing UTXO's from janus
     * prepareRequest in https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/json-rpc-provider.ts
     */
    prepareRequest(method, params) {
        if (method === "qtum_qetUTXOs") {
            return ["qtum_getUTXOs", params];
        }
        return super.prepareRequest(method, params);
    }
}
exports.QtumProvider = QtumProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9RdHVtUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBSW5DLDJDQUF5RDtBQUV6RCxNQUFhLFlBQWEsU0FBUSxrQkFBUyxDQUFDLGVBQWU7SUFDekQsWUFDRSxHQUE2QixFQUM3QixPQUE4QjtRQUU5QixLQUFLLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsZUFBZSxDQUNuQixpQkFBMkM7UUFFM0MsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDeEIsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDMUQsTUFBTSxLQUFLLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM5QixvQ0FBb0M7UUFDcEMsTUFBTSxFQUFFLEdBQUcsOEJBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsSUFBSTtZQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRTtnQkFDakQsaUJBQWlCLEVBQUUsS0FBSzthQUN6QixDQUFDLENBQUM7WUFDSCxnREFBZ0Q7WUFDaEQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7U0FDM0M7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLEtBQUssQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1lBQ3ZCLEtBQUssQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztZQUNoQyxNQUFNLEtBQUssQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQUNEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBYSxFQUFFLFlBQXFCO1FBQ2pELE1BQU0sSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3hCLE1BQU0sTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLE1BQVcsRUFBRSxNQUFXO1FBQ3JDLElBQUksTUFBTSxLQUFLLGVBQWUsRUFBRTtZQUM5QixPQUFPLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ2xDO1FBQ0QsT0FBTyxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUFwREQsb0NBb0RDIn0=