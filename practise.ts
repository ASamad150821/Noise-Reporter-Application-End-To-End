const returnName = () => {
    return "Mohammed"
};
const nameReturned = returnName();
console.log(nameReturned);

const returnName2 = () => "Mohammed";
const nameReturned2 = returnName2();
console.log(nameReturned2);


const printName = () => console.log("Abdul");
printName();

const printName2 = () => {
    console.log("Abdul")
}
printName2();