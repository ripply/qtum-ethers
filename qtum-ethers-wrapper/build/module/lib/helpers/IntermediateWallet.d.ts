import { Wallet } from "ethers";
export declare abstract class IntermediateWallet extends Wallet {
    abstract address: string;
}
