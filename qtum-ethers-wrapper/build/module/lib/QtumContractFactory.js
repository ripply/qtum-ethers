import { ContractFactory } from "ethers";
import { defineReadOnly, getStatic, } from "ethers/lib/utils";
import { getAddress } from "@ethersproject/address";
import { Logger } from "@ethersproject/logger";
import { generateContractAddress } from "./utils";
const version = "contracts/5.1.1";
const logger = new Logger(version);
async function resolveName(resolver, nameOrPromise) {
    const name = await nameOrPromise;
    // If it is already an address, just use it (after adding checksum)
    try {
        return getAddress(name);
    }
    catch (error) { }
    if (!resolver) {
        logger.throwError("a provider or signer is needed to resolve ENS names", Logger.errors.UNSUPPORTED_OPERATION, {
            operation: "resolveName"
        });
    }
    const address = await resolver.resolveName(name);
    if (address == null) {
        logger.throwArgumentError("resolver or addr is not configured for ENS name", "name", name);
    }
    return address;
}
// Recursively replaces ENS names with promises to resolve the name and resolves all properties
async function resolveAddresses(resolver, value, paramType) {
    if (Array.isArray(paramType)) {
        return await Promise.all(paramType.map((paramType, index) => {
            return resolveAddresses(resolver, ((Array.isArray(value)) ? value[index] : value[paramType.name]), paramType);
        }));
    }
    if (paramType.type === "address") {
        return await resolveName(resolver, value);
    }
    if (paramType.type === "tuple") {
        return await resolveAddresses(resolver, value, paramType.components);
    }
    if (paramType.baseType === "array") {
        if (!Array.isArray(value)) {
            return Promise.reject(new Error("invalid value for array"));
        }
        return await Promise.all(value.map((v) => resolveAddresses(resolver, v, paramType.arrayChildren)));
    }
    return value;
}
export class QtumContractFactory extends ContractFactory {
    constructor(contractInterface, bytecode, signer) {
        super(contractInterface, bytecode, signer);
    }
    async deploy(...args) {
        let overrides = {};
        // If 1 extra parameter was passed in, it contains overrides
        if (args.length === this.interface.deploy.inputs.length + 1) {
            overrides = args.pop();
        }
        // Make sure the call matches the constructor signature
        logger.checkArgumentCount(args.length, this.interface.deploy.inputs.length, " in Contract constructor");
        // Resolve ENS names and promises in the arguments
        const params = await resolveAddresses(this.signer, args, this.interface.deploy.inputs);
        params.push(overrides);
        // Get the deployment transaction (with optional overrides)
        const unsignedTx = this.getDeployTransaction(...params);
        // Send the deployment transaction
        const tx = await this.signer.sendTransaction(unsignedTx);
        // @ts-ignore
        console.log(tx, 'txSigned');
        const address = `0x${generateContractAddress("")}`;
        const contract = getStatic(this.constructor, "getContract")(address, this.interface, this.signer);
        defineReadOnly(contract, "deployTransaction", tx);
        return contract;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bUNvbnRyYWN0RmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bUNvbnRyYWN0RmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFrRCxNQUFNLFFBQVEsQ0FBQTtBQUN4RixPQUFPLEVBQUUsY0FBYyxFQUFFLFNBQVMsR0FBRyxNQUFNLGtCQUFrQixDQUFBO0FBRTdELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNwRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFL0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sU0FBUyxDQUFDO0FBQ2xELE1BQU0sT0FBTyxHQUFHLGlCQUFpQixDQUFDO0FBRWxDLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRW5DLEtBQUssVUFBVSxXQUFXLENBQUMsUUFBMkIsRUFBRSxhQUF1QztJQUMzRixNQUFNLElBQUksR0FBRyxNQUFNLGFBQWEsQ0FBQztJQUVqQyxtRUFBbUU7SUFDbkUsSUFBSTtRQUNBLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzNCO0lBQUMsT0FBTyxLQUFLLEVBQUUsR0FBRztJQUVuQixJQUFJLENBQUMsUUFBUSxFQUFFO1FBQ1gsTUFBTSxDQUFDLFVBQVUsQ0FBQyxxREFBcUQsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLHFCQUFxQixFQUFFO1lBQzFHLFNBQVMsRUFBRSxhQUFhO1NBQzNCLENBQUMsQ0FBQztLQUNOO0lBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWpELElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtRQUNqQixNQUFNLENBQUMsa0JBQWtCLENBQUMsaURBQWlELEVBQUUsTUFBTSxFQUFFLElBQUksQ0FB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