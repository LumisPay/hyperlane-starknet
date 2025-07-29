# Hyperlane - Starknet Sepolia <> Gnosis Chiado - Warp Route Deployment Guide

We use the Hyperlane protocol to deploy a Warp route between Starknet and Gnosis Chiado. This allows us to transfer tokens between these two networks efficiently.

## Table of Contents

- [Setup](#setup)
- [Deploy Warp Route on Starknet and Gnosis Chiado](#deploy-warp-route-on-starknet-and-gnosis-chiado)
- [Set Up the Relayer](#set-up-the-relayer)
- [Start the Relayer](#start-the-relayer)
- [Testing the Warp Route](#testing-the-warp-route)
- [🚩 Pitfalls](#🚩-pitfalls)

## Setup

To set up the project, follow these steps:

### Install Dependencies

1. Make sure dependencies are installed on both the `/example` and `/scripts` directory:

```bash
npm i
cd ../scripts && npm i && cd ../example
```

2. Build the Cairo contracts:

```bash
cd ../cairo && scarb build && cd ../example
```

### Setup Environment Variables

1. Copy the `.env.example` file from `/example` directory to `.env` and populate the necessary variables

2. Copy the `.env.example` file from `/scripts` directory to `.env` and populate the necessary variables

### Gas Fees

Ensure you have enough gas fees in your Starknet Sepolia account. You can use the [Starknet Faucet](https://starknet-faucet.vercel.app/) to get some test STRK.

### Hyperlane CLI

Install the [Hyperlane CLI](https://docs.hyperlane.xyz/docs/reference/developer-tools/cli) globally:

```bash
npm install -g @hyperlane-xyz/cli
```

## Deploy Warp Route on Starknet and Gnosis Chiado

This guide will help you deploy the Warp route on Starknet and Gnosis Chiado.

1.  **Deploy Starknet Core Contracts**

    ```bash
    npm run deploy
    ```

    A file with all deployed contracts will be generated at the following path `./scripts/deployments/starknet_sepolia/deployments.json`.

2.  **Generate `starknetsepolia-deploy.yaml` file:**

    ```bash
    hyperlane warp init
    ```

    <details closed>
      <summary><b>The prompts should be similar to the following: (click to expand)</b></summary>

    ? Select chains to connect gnosischiadotestnet, starknetsepolia <br />
    ? Is this chain selection correct?: gnosischiadotestnet, starknetsepolia yes <br />
    gnosischiadotestnet: Configuring warp route... <br />
    ? Enter the desired owner address: 0x_your_gnosischiado_owner_address <br />
    ? Use an existing Proxy Admin contract for the warp route deployment on chain "gnosischiadotestnet"? no <br />
    ? Do you want to use a trusted ISM for warp route? yes <br />
    ? Select gnosischiadotestnet's token type collateral <br />
    ? Enter the existing token address on chain gnosischiadotestnet 0x_gnosischiado_token_you_want_to_bridge_address <br />
    starknetsepolia: Configuring warp route... <br />
    ? Enter the desired owner address: 0x_your_starknetsepolia_owner_address <br />
    ? Use an existing Proxy Admin contract for the warp route deployment on chain "starknetsepolia"? no <br />
    ? Do you want to use a trusted ISM for warp route? yes <br />
    ? Select starknetsepolia's token type synthetic <br />
    Warp Route config is valid, writing to file undefined:

  </details>
  <br />

3.  **Build the Warp route contract:**

    ```bash
    npm run deploy-route
    ```

    This will deploy the Warp route contract on Starknet and print the deployed contract address.

    <details closed>
      <summary><b>Example output:</b></summary>

    Declaring contract HypERC20... <br />
    Contract HypERC20 declared with class hash: 0x_class_hash <br />
    HypERC20 contract deployed at address: 0x_deployed_contract_address

    </details>
    <br />

4.  **Replace the `starknetsepolia` section in `starknetsepolia-deploy.yaml`**

    ```yaml
    starknetsepolia:
      foreignDeployment: 0x<address_from_step_3> # deployed contract
      remoteDecimals: 18 # Chiado token decimals
      mailbox: 0x<mailbox_address_from_step_1> # mailbox contract
      interchainSecurityModule: 0x<ism_address_from_step_1>
      owner: 0x<your_starknet_account> # your address
      type: synthetic
    ```

    the file is located at `~/.hyperlane/deployments/warp_routes/$COLLATERAL_TICKER`

     <details closed>
       <summary><b>Example starknetsepolia-deploy.yaml</b></summary>

    ```yaml
    gnosischiadotestnet:
      interchainSecurityModule:
        modules:
          - relayer: '0x_your_relayer_address'
            type: trustedRelayerIsm
          - domains: {}
            owner: '0x_your_gnosischiado_ism_owner_address'
            type: defaultFallbackRoutingIsm
        threshold: 1
        type: staticAggregationIsm
      owner: '0x_your_gnosischiado_owner_address'
      token: '0x_gnosischiado_token_you_want_to_bridge_address'
      type: collateral
    starknetsepolia:
      foreignDeployment: '0x_deployed_contract_address_from_step_3' # address from step 3
      remoteDecimals: 18 # decimals of the token on Gnosis Chiado
      mailbox: '0x_your_starknetsepolia_mailbox_address'
      interchainSecurityModule: '0x_your_starknetsepolia_ism_address'
      type: synthetic # the type of contract deployed on Starknet, here it is synthetic of the original token
      owner: '0x_your_starknetsepolia_owner_address'
    ```

     </details>
     <br />

5.  **Deploy the Warp route to Gnosis Chiado:**

    ```bash
    hyperlane warp deploy
    ```

    Select your token route from the list, and confirm the deployment.
    Once it's done, you will see something like this:
    `Successfully deployed contracts on gnosischiadotestnet`

    Then `Error: address bytes must not be empty`, it's a known issue, you can ignore it as we enroll the router on next step.

6.  **Enroll the remote router on Starknet**

    Go to `enroll-remote-router.ts` and update `REMOTE_TOKEN_ADDRESS`, `REMOTE_DOMAIN_ID`, and `STARKNET_SYNTHETIC_ADDRESS` with the values from the previous steps.

    then run the script:

    ```bash
    npm run enroll-remote-router
    ```

<br />

You are now ready to use the Warp route on both Starknet and Gnosis Chiado 🎉

<br />

## Set Up the Relayer

### Configure Environment Variables

To set up the Hyperlane relayer, configure the environment variables. Copy the example environment file and modify it as needed:

```bash
cp infra/.env.example infra/.env
```

### Update the config.json file

Update the `infra/config.json` file with the contract addresses from the deployments.json file generated in step 1.

## Start the Relayer

At this point, you can start the Hyperlane relayer to handle messages between the two networks:

```bash
cd infra && docker-compose -f docker-compose.relayer.yml up --force-recreate --remove-orphans
```

## Testing the Warp Route

The Hyperlane commands cannot send messages to non-EVM chains.

## Validator

The validator is not implemented in this example

### Starknet ➡ Gnosis Chiado

```bash
npm run bridge:to:starknet
```

### Gnosis Chiado ➡ Starknet

```bash
npm run bridge:to:gnosis
```

## 🚩 Pitfalls

- Ensure the ISMs (Interchain Security Modules) are correctly set up on both networks. Or that the NoopIsm is used for testing purposes.
- Approve HypERC20Collateral spender on collateral token (Original ERC20).
- To bridge from Starknet, do not forget to mention the `new CairoOption<Order>(CairoOptionVariant.None)` for `hook`and `hook_metadata`
