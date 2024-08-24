# Donation Demo Contract

- This is a demo smart contract that makes a donation to a specific project.

## Setup
- Please prepare .env to execute the script.
```
PRIVATE_KEY=your private key 1
DONOR_PRIVATE_KEY=your private key 1
CONTRACT_ADDRESS=0x718A7bd29A562554Df17882181D0aD73d6C4737e
```

## Scripts
```shell
% npx hardhat run scripts/deploy.ts --network kairos       
Compiled 1 Solidity file successfully (evm target: paris).
Donation deployed to: 0x718A7bd29A562554Df17882181D0aD73d6C4737e
% npx hardhat run scripts/createProject.ts --network kairos      
Creating a new project with 3 minutes duration...
Project created successfully!
Transaction hash: 0xbd01ed2cb40d3236e32e68ed185ab91f264d94795386d9b4e4be28695058887b
Project Details:
ID: 1
Goal: 1.0 KAIA
Description: Test Project - 3 Minutes Duration
Deadline: 2024/8/24 16:55:47
Owner: 0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0
Total Funds: 0.0 KAIA
Claimed: false
Project will end in approximately 180 seconds
% npx hardhat run scripts/donate.ts --network kairos             
Donating 1.0 KAIA to project 1...
Donation successful!
Transaction hash: 0x6c71a0133f1d48cf692ee5b3144478ba2983cbcb5ec2fa9488d473061992789d
Updated Project Details: Result(7) [
  1n,
  1000000000000000000n,
  'Test Project - 3 Minutes Duration',
  1724486147n,
  '0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0',
  1000000000000000000n,
  false
]
% PROJECT_ID=1 npx hardhat run scripts/getProjectDetails.ts --network kairos
Fetching details for project ID: 1
Project Details:
ID: 1
Goal: 1.0 KAIA
Description: Test Project - 3 Minutes Duration
Deadline: 2024/8/24 16:55:47
Owner: 0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0
Total Funds: 1.0 KAIA
Claimed: false
Project will end in approximately 156 seconds
Progress: 100.00% (1 KAIA / 1 KAIA)
% npx hardhat run scripts/claimFunds.ts --network kairos             
Claiming funds for project 1...
Error claiming funds: ProviderError: execution reverted: Funding period has not ended yet
    at HttpProvider.request (/Users/jp24217/dev/don-chan/donation-contract/node_modules/hardhat/src/internal/core/providers/http.ts:107:21)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async HardhatEthersProvider.estimateGas (/Users/jp24217/dev/don-chan/donation-contract/node_modules/@nomicfoundation/hardhat-ethers/src/internal/hardhat-ethers-provider.ts:246:27)
    at async /Users/jp24217/dev/don-chan/donation-contract/node_modules/@nomicfoundation/hardhat-ethers/src/signers.ts:235:35
    at async Promise.all (index 0)
    at async HardhatEthersSigner._sendUncheckedTransaction (/Users/jp24217/dev/don-chan/donation-contract/node_modules/@nomicfoundation/hardhat-ethers/src/signers.ts:256:7)
    at async HardhatEthersSigner.sendTransaction (/Users/jp24217/dev/don-chan/donation-contract/node_modules/@nomicfoundation/hardhat-ethers/src/signers.ts:125:18)
    at async send (/Users/jp24217/dev/don-chan/donation-contract/node_modules/ethers/src.ts/contract/contract.ts:313:20)
    at async Proxy.claimFunds (/Users/jp24217/dev/don-chan/donation-contract/node_modules/ethers/src.ts/contract/contract.ts:352:16)
    at async main (/Users/jp24217/dev/don-chan/donation-contract/scripts/claimFunds.ts:14:20)
% PROJECT_ID=1 npx hardhat run scripts/getProjectDetails.ts --network kairos
Fetching details for project ID: 1
Project Details:
ID: 1
Goal: 1.0 KAIA
Description: Test Project - 3 Minutes Duration
Deadline: 2024/8/24 16:55:47
Owner: 0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0
Total Funds: 1.0 KAIA
Claimed: false
Project has ended
Progress: 100.00% (1 KAIA / 1 KAIA)
% npx hardhat run scripts/claimFunds.ts --network kairos                    
Claiming funds for project 1...
Funds claimed successfully!
Transaction hash: 0x8734450e616886ebf9459157eb519c621dfd9880cca14b0f12ea3eb794023ff2
Updated Project Details: Result(7) [
  1n,
  1000000000000000000n,
  'Test Project - 3 Minutes Duration',
  1724486147n,
  '0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0',
  1000000000000000000n,
  true
]
% PROJECT_ID=1 npx hardhat run scripts/getProjectDetails.ts --network kairos
Fetching details for project ID: 1
Project Details:
ID: 1
Goal: 1.0 KAIA
Description: Test Project - 3 Minutes Duration
Deadline: 2024/8/24 16:55:47
Owner: 0x2d3F13cB14794CD788b0E0901314f55Cd84e2AC0
Total Funds: 1.0 KAIA
Claimed: true
Project has ended
Progress: 100.00% (1 KAIA / 1 KAIA)
```

## Useful sites
- Here is a list of useful sites for testing on Kaia Chain's testnet.
- Kaiascope
  - https://baobab.klaytnscope.com/
- Kaia Faucet
  - https://www.kaia.io/ja/partners/kaia-faucet
- Kaia Wallet
  - https://www.kaiawallet.io/
