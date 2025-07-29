import dotenv from 'dotenv';

import fs from 'fs';
import { Account, byteArray, cairo, CallData, ContractFactory, ContractFactoryParams, json } from 'starknet';
import TESTNET_DEPLOYMENTS from '../../scripts/deployments/STARKNET_SEPOLIA/deployments.json';
import { buildAccount } from '../../scripts/utils';

dotenv.config();

const TOKEN_PATH = '../cairo/target/dev/token';

function findContractFile(name: string, suffix: string): string {
	const tokenPath = `${TOKEN_PATH}_${name}${suffix}`;

	if (fs.existsSync(tokenPath)) {
		return tokenPath;
	}

	throw new Error(`Contract file not found for ${name} with suffix ${suffix} at ${tokenPath}`);
}

export function getCompiledContract(name: string): any {
	const contractPath = findContractFile(name, '.contract_class.json');
	return json.parse(fs.readFileSync(contractPath).toString('ascii'));
}

export function getCompiledContractCasm(name: string): any {
	const contractPath = findContractFile(name, '.compiled_contract_class.json');
	return json.parse(fs.readFileSync(contractPath).toString('ascii'));
}

export async function declareContract(account: Account, name: string): Promise<string> {
	console.log(`Declaring contract ${name}...`);
	const compiledContract = getCompiledContract(name);
	const casm = getCompiledContractCasm(name);

	const declareResponse = await account.declareIfNot({
		contract: compiledContract,
		casm
	});

	console.log(`Contract ${name} declared with class hash:`, declareResponse.class_hash);

	return declareResponse.class_hash;
}

/**
 * We deploy an HypERC20 contract to the Starknet network.
 */
async function main() {
	const account = await buildAccount();

	if (!TESTNET_DEPLOYMENTS.mailbox || !TESTNET_DEPLOYMENTS.hook || !TESTNET_DEPLOYMENTS.aggregation) {
		throw new Error(
			'Missing required deployment addresses in TESTNET_DEPLOYMENTS. \n> Please run make deploy-starknet-contracts first'
		);
	}

	// to update as you need
	const constructor = {
		decimals: 18,
		mailbox: TESTNET_DEPLOYMENTS.mailbox as string,
		total_supply: cairo.uint256('0'),
		name: byteArray.byteArrayFromString('yourDesiredTokenName'),
		symbol: byteArray.byteArrayFromString('yourDesiredTokenSymbol'),
		hook: TESTNET_DEPLOYMENTS.hook as string,
		// please not that we use noop_ism for testing purposes
		// in production you should use the actual ISM contract address
		interchain_security_module: TESTNET_DEPLOYMENTS.noop_ism as string,
		owner: account.address as string
	};

	const contractName = 'HypERC20';

	const classHash = await declareContract(account, contractName);

	const compiledContract = getCompiledContract(contractName);
	const casm = getCompiledContractCasm(contractName);
	const constructorCalldata = CallData.compile(constructor);
	const params: ContractFactoryParams = {
		compiledContract,
		account,
		casm,
		classHash
	};

	const contractFactory = new ContractFactory(params);
	const contract = await contractFactory.deploy(constructorCalldata);

	console.log(`HypERC20 contract deployed at address: ${contract.address}`);
}

main();
