pragma solidity ^0.8.0;

interface IEventWitness {
    event EventWitnessed(address indexed sender, bytes32 indexed hash);
    function witness(bytes calldata evt) external ;
}