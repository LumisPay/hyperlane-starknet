import dotenv from 'dotenv';

import fs from 'fs';
import { CallData, Contract, json, num, uint256 } from 'starknet';
import TESTNET_DEPLOYMENTS from '../../scripts/deployments/STARKNET_SEPOLIA/deployments.json';
import { buildAccount } from '../../scripts/utils';

dotenv.config();

// the hypERC20Collateral contract on Gnosis Chiado chain
const REMOTE_TOKEN_ADDRESS = '0x_your_gnosischiado_token_you_want_to_bridge_address';
// the domain ID of the Gnosis chain
const REMOTE_DOMAIN_ID = '10200'; // Gnosis Chiado chain domain ID
// synthetic on starknet
const STARKNET_SYNTHETIC_ADDRESS = '0x_your_synthetic_hyper20_address'; // synthetic HypERC20 on Starknet

function findContractFile(name: string, suffix: string): string {
	const TOKEN_PATH = '../cairo/target/dev/token';
	const tokenPath = `${TOKEN_PATH}_${name}${suffix}`;
	console.log('tokenPath:', tokenPath);
	if (fs.existsSync(tokenPath)) {
		return tokenPath;
	}

	throw new Error(`Contract file not found for ${name} with suffix ${suffix} at ${tokenPath}`);
}

function getCompiledContract(name: string): any {
	const contractPath = findContractFile(name, '.contract_class.json');
	return json.parse(fs.readFileSync(contractPath).toString('ascii'));
}
/**
 * We deploy an HypERC20 contract to the Starknet network.
 */
async function main() {
	const account = await buildAccount();

	if (!TESTNET_DEPLOYMENTS.mailbox || !TESTNET_DEPLOYMENTS.hook || !TESTNET_DEPLOYMENTS.aggregation) {
		throw new Error('Missing required deployment addresses in TESTNET_DEPLOYMENTS');
	}

	const constructor = {
		// gnosis chain domain id
		domain: REMOTE_DOMAIN_ID,
		router: uint256.bnToUint256(num.toBigInt(REMOTE_TOKEN_ADDRESS))
	};

	const constructorCalldata = CallData.compile(constructor);

	const compiledContract = getCompiledContract('HypErc20');

	const contract = new Contract(compiledContract.abi, STARKNET_SYNTHETIC_ADDRESS);

	console.log('Enrolling remote router for HypERC20 contract...');

	const tx = await account.execute({
		contractAddress: contract.address,
		entrypoint: 'enroll_remote_router',
		calldata: constructorCalldata
	});

	await account.waitForTransaction(tx.transaction_hash);

	console.log(`✅ Remote router enrolled successfully for HypERC20 contract at address ${STARKNET_SYNTHETIC_ADDRESS}`);
}

main();
