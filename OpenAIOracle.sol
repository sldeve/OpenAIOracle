// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OpenAIOracle {
    // The address of the oracle service
    address public oracleAddress;
    
    // Mapping of user addresses to their ChatGPT questions
    mapping(address => string) public userQuestions;

    // Mapping of user addresses to ChatGPT responses
    mapping(address => string) public userResponses;

    // Event to notify the oracle of a new question
    event NewQuestion(address indexed user, string question);

    // Contract constructor
    constructor(address _oracleAddress) {
        oracleAddress = _oracleAddress;
    }
    // Function for users to ask a question to ChatGPT
    function askQuestion(string memory _question) external {
        require(bytes(_question).length > 0, "Question cannot be empty");
        userQuestions[msg.sender] = _question;
        emit NewQuestion(msg.sender, _question);
    }

    // Function for the oracle to provide an answer
    function provideAnswer(address _user, string memory _answer) external {
        require(msg.sender == oracleAddress, "Only the oracle can answer");
        require(bytes(userQuestions[_user]).length > 0, "No question from user");
        userResponses[_user] = _answer;
    }

    // Function for users to retrieve the answer to their question
    function getAnswer() external view returns (string memory) {
        return userResponses[msg.sender];
    }
}
