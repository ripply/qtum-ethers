import { providers } from "ethers";
import { parseSignedTransaction } from "./utils";
export class QtumProvider extends providers.JsonRpcProvider {
    constructor(url, network) {
        super(url, network);
    }
    /**
     * Override for ETH parsing of transaction
     * https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/base-provider.ts
     */
    async sendTransaction(signedTransaction) {
        await this.getNetwork();
        const signedTx = await Promise.resolve(signedTransaction);
        const hexTx = `0x${signedTx}`;
        // Parse the signed transaction here
        const tx = parseSignedTransaction(signedTx);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9RdHVtUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUluQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFDakQsTUFBTSxPQUFPLFlBQWEsU0FBUSxTQUFTLENBQUMsZUFBZTtJQUN6RCxZQUNFLEdBQTZCLEVBQzdCLE9BQThCO1FBRTlCLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxlQUFlLENBQ25CLGlCQUEyQztRQUUzQyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN4QixNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMxRCxNQUFNLEtBQUssR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzlCLG9DQUFvQztRQUNwQyxNQUFNLEVBQUUsR0FBRyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1QyxJQUFJO1lBQ0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFO2dCQUNqRCxpQkFBaUIsRUFBRSxLQUFLO2FBQ3pCLENBQUMsQ0FBQztZQUNILGdEQUFnRDtZQUNoRCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztTQUMzQztRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsS0FBSyxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7WUFDdkIsS0FBSyxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO1lBQ2hDLE1BQU0sS0FBSyxDQUFDO1NBQ2I7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFhLEVBQUUsWUFBcUI7UUFDakQsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDeEIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDcEMsT0FBTyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjLENBQUMsTUFBVyxFQUFFLE1BQVc7UUFDckMsSUFBSSxNQUFNLEtBQUssZUFBZSxFQUFFO1lBQzlCLE9BQU8sQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDbEM7UUFDRCxPQUFPLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzlDLENBQUM7Q0FDRiJ9