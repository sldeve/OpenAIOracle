require('dotenv').config();
const OpenAI = require('openai');
const Web3 = require('web3');
const fs = require('fs');

const LAST_BLOCK_FILE = 'lastBlock.txt';

const {
    ETHEREUM_NODE_URL,
    CONTRACT_ADDRESS,
    ORACLE_ACCOUNT_ADDRESS,
    PRIVATE_KEY
} = process.env;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Connect to Ethereum node
const web3 = new Web3(ETHEREUM_NODE_URL);

// Contract ABI
const contractABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_oracleAddress",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "question",
				"type": "string"
			}
		],
		"name": "NewQuestion",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_question",
				"type": "string"
			}
		],
		"name": "askQuestion",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getAnswer",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "oracleAddress",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "_answer",
				"type": "string"
			}
		],
		"name": "provideAnswer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userQuestions",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userResponses",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]
const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// If lastBlock.txt doesn't exist, initialize with 0
if (!fs.existsSync(LAST_BLOCK_FILE)) {
    fs.writeFileSync(LAST_BLOCK_FILE, '0');
}

// Read the last processed block from the file
let lastProcessedBlock = parseInt(fs.readFileSync(LAST_BLOCK_FILE, 'utf-8'));

// Make sure lastProcessedBlock is a valid number
if (isNaN(lastProcessedBlock)) {
    console.warn("Invalid block number detected in lastBlock.txt. Resetting to 0.");
    lastProcessedBlock = 0;
    fs.writeFileSync(LAST_BLOCK_FILE, '0');
}

// Periodically check for events every 30 seconds
setInterval(async () => {
    try {
        const latestBlock = await web3.eth.getBlockNumber();
        if (latestBlock <= lastProcessedBlock) {
            console.log("No new blocks since last check. Waiting...");
            return;
        }

        const events = await contract.getPastEvents('NewQuestion', {
            fromBlock: lastProcessedBlock + 1,
            toBlock: 'latest'
        });

        for (const event of events) {
            const userAddress = event.returnValues.user;
            const question = event.returnValues.question;

            // Fetch answer from OPENAI service using the chat model
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: question }],
                model: 'gpt-3.5-turbo',
            });

            const answer = completion.choices[0].message.content.trim();
            
            // Prepare the transaction
            const tx = contract.methods.provideAnswer(userAddress, answer).encodeABI();
            const nonce = await web3.eth.getTransactionCount(ORACLE_ACCOUNT_ADDRESS, 'pending');
            const estimatedGas = await web3.eth.estimateGas({ to: CONTRACT_ADDRESS, data: tx });
            console.log("Nonce",nonce);
            const rawTransaction = {
                from: ORACLE_ACCOUNT_ADDRESS,
                to: CONTRACT_ADDRESS,
                gas: estimatedGas,
                nonce: nonce,
                data: tx,
            };
            console.log(rawTransaction);
            const accountFromPrivateKey = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
            console.log('Account derived from PRIVATE_KEY:', accountFromPrivateKey.address);
            
            // Sign & send the transaction
            const signedTx = await web3.eth.accounts.signTransaction(rawTransaction, PRIVATE_KEY);
            web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on('receipt', console.log)
                .on('error', console.error);

            // After successfully processing, update the last processed block
            fs.writeFileSync(LAST_BLOCK_FILE, event.blockNumber.toString());
        }

        // Update the lastProcessedBlock for the next interval
        lastProcessedBlock = latestBlock;

    } catch (error) {
        console.error("Error in periodic check:", error);
    }
}, 30000);  // 30000 milliseconds = 30 seconds
