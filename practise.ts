let returnName = () => {
    return "Mohammed"
};
let nameReturned = returnName();
console.log(nameReturned);

let returnName2 = () => "Mohammed";
let nameReturned2 = returnName2();
console.log(nameReturned2);


let printName = () => console.log("Abdul");
printName();

let printName2 = () => {
    console.log("Abdul")
}
printName2();