require('dotenv').config();
const Web3 = require('web3');
const axios = require('axios');

// Load values from .env file
const {
    ETHEREUM_NODE_URL,
    CONTRACT_ADDRESS,
    ORACLE_ACCOUNT_ADDRESS,
    PRIVATE_KEY,
    OPENAI_API_URL
} = process.env;

// Connect to Ethereum node
const web3 = new Web3(ETHEREUM_NODE_URL);

// Contract ABI
const contractABI = [ ];
const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// Listen to NewQuestion events
contract.events.NewQuestion({ fromBlock: 'latest' })
.on('data', async (event) => {
    try {
        const userAddress = event.returnValues.user;
        const question = event.returnValues.question;

        // Fetch answer from OPENAI service
        const openaiResponse = await axios.post(OPENAI_API_URL, { question: question });
        const answer = openaiResponse.data.answer;

        // Prepare the transaction
        const tx = contract.methods.provideAnswer(userAddress, answer).encodeABI();
        const nonce = await web3.eth.getTransactionCount(ORACLE_ACCOUNT_ADDRESS, 'pending');
        const estimatedGas = await web3.eth.estimateGas({ to: CONTRACT_ADDRESS, data: tx });

        const rawTransaction = {
            to: CONTRACT_ADDRESS,
            gas: estimatedGas,
            nonce: nonce,
            data: tx,
        };

        // Sign & send the transaction
        const signedTx = await web3.eth.accounts.signTransaction(rawTransaction, PRIVATE_KEY);
        web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on('receipt', console.log)
            .on('error', console.error);

    } catch (error) {
        console.error("Error processing question:", error);
    }
});
