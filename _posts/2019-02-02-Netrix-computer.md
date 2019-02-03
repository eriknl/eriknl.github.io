---
layout: post
title:  "Let's make a nurse call system Turing complete!"
date:   2019-02-02 15:00:00 +0200
category: hack
tags: [software, hack, Turing complete, cpu, assembly]
---
This post details my research on how to set up a nurse call messaging server to be a Turing complete virtual computer.

Introduction
------------

One of the things I am involved with in my day job is nurse call systems, these systems are installed in places such as hospitals and retirement homes to signal staff that a patient is in need of attention.
These kind of systems usually consist of room units in the patient rooms or wireless call buttons from which the calls are intiated and central processing system called a messaging server. The messaging server is used to send the calls to pagers, telephones, smartphone apps or other ways to alert the staff. The messaging server is often also used as an interface to connect other systems in the building like fire alarm systems with the staff for messaging.
To get all calls to the right people at the right time the messaging server has to route messages according to parameters such as the time of day and urgency of the message.

One of the messaging servers I am familiar with is called _Netrix_ and is part of the nurse call system iCall by [IndigoCare](https://www.indigo-care.com). Though personally I am not thrilled this a graphical Windows program (yes, it is not a service), it does its job and has definitely saved plenty of lives. I have written the Wireshark dissectors for the two protocols used by the room units and the messaging server.
Recently I was giving in-company training on the iCall system and Netrix messaging server when it struck me that certain routing features might be used for more than just sending text messages to pagers so I spent some time researching how to turn the Netrix application into a rudimentary computer system that will execute a program of assembly style instructions with conditional branching.


Netrix background
-------

Before getting further into the story I will explain the basic mechanics of message routing used by the Netrix application that are relevant for this post.

### Conversion table ###
A _conversion table_ is a table that has two columns: _original_ and _translation_. The purpose of a conversion table is to search and replace known values, this is used for things like translating wireless call button IDs to room numbers.

### Group ###
A _group_ is a way to specify recipients for a message, recipients are called _participants_. Each participant can be of a different type and have a different payload. A group is called with parameters called `MSG1` to `MSG6`, these parameters contain information like room number or patient name. A group is addressed by its number.
Participants can be of a variety of types like phones, pagers, other groups (message parameters can be manipulate before being passed on) or text log files. There is also a special kind of participant that is used to add/overwrite or delete values in a _conversion table_.
When passing on parameters to group participants they can be manipulated in several ways and all operations are done on text strings. Some examples:
* Look up the translation of a hardcoded string in a conversion table (e.g. to get the value for key _keyname_ in conversiontable _foo_ `&[GETVAR]foo,keyname]`)
* Look up the translation of a group call parameter in a hardcoded conversion table (e.g. to get the value for a key with the text in _MSG1_ in conversiontable _foo_ `&[MSG1C]foo]`)
* Look up the reverse translation of a group call parameter in a hardcoded conversion table (e.g. to get the key for a value with the text in _MSG1_ in conversiontable _foo_ `&[MSG1CS]foo]`)
* Hardcoded text, some dynamic values (date/time etc), input parameters (e.g. to get the text in _MSG1_ `&[MSG1]`) and the above translation results can concatenated

Important information about participant operations:
- All lookup operations are nonrecursive
- All fields used to call a participant can be manipulated this includes the number to indicate which group is called as a participant
- Every participant in a group is called on sequentially not in parallel, the order is the order listed in the interface of the Netrix
- If another group is called as a participant this execution will be executed before going to the next participant in the parent group

I will make use of four types of participants:

| Type            | Explanation                                                        |
|:----------------|:-------------------------------------------------------------------|
| COMMON DEBUG    | Print a message to the general debug window                        |
| Group           | Execute a specified group, `MSG1` to `MSG6` are passed on verbatim |
| Group MSG1-6    | Execute a specified group, `MSG1` to `MSG6` can be specified       |
| CONVERSIONTABLE | Add/overwrite or remove an entry in a conversion table             |

Turing completeness
-------

For a full explanation of Turing completeness I have to refer to [Wikipedia](https://en.wikipedia.org/wiki/Turing_completeness), but the general idea is the following:
> To show that something is Turing complete, it is enough to show that it can be used to simulate some Turing complete system. For example, an imperative language is Turing complete if it has conditional branching (e.g., "if" and "goto" statements, or a "branch if zero" instruction; see one instruction set computer) and the ability to change an arbitrary amount of memory (e.g., the ability to maintain an arbitrary number of data items). Of course, no physical system can have infinite memory; but if the limitation of finite memory is ignored, most programming languages are otherwise Turing complete.

In order to be Turing complete it ought to be sufficient to design a configuration that will allow execution of a program with addressable memory and conditional branching. I will design a configuration of the Netrix that will work as a virtual machine to accomplish this.


General design of the _Netrix Virtual Machine_
-------

To keep things simple I will employ a mock [Von Neumann architecture](https://en.wikipedia.org/wiki/Von_Neumann_architecture), this means the program instructions are stored in the same memory where data is manipulated. This makes is easy for me to reserve memory to read/write around the instructions of the program.


### Memory ###
The only data structure available for storage is the _conversion table_, so I will define a conversion table `memory` to act as my addressable memory. Because the conversion tables are tables without indexed rows I use the _original_ column to keep the address of the memory cell and the _translation_ column to keep the data. This will result in the `memory` looking something like this when instructions are in memory:

| address | content             |
|:--------|:--------------------|
| 0       | &lt;instruction&gt; |
| 1       | &lt;operand&gt;     |
| 2       | &lt;instruction&gt; |
| 3       | &lt;operand&gt;     |

This "memory" is addressable using the _original_ column, it's of course important to make sure the addressing is correctly entered in this column and that no double addresses are assigned. `&[GETVAR]memory,address]` can now be used to read memory, writing can be accomplished by using the special group participant type to add/overwrite a value for a key in a conversion table.

### Processor registers ###
Another conversion table `register` will be reserved for registers for the virtual processor, at least a program counter (referring to an address in `memory`) and a zero flag will be added as keys here.

### Processor operation ###
As usual the processor starts by reading the instruction at the memory cell that the `pc` register indicates, then the instruction is executed and the `pc` register is updated to point to the next instruction in memory to execute.
At certain points some scratch memory will be needed for internal usage when executing instructions so another conversion table `processor` is added. This memory is not available to the programs and instructions are free to consider this memory volatile.

#### Read instruction ####
Because it is not possible to use the functions we can apply on the conversion tables in a recursive way we have to work around this by loading the memory content into a hardcoded place which we can then pass on as the parameter to a group call on the next line. This pattern will be used extensively as a work around.

#### Execute instruction ####
This is where we need to have a way for the Netrix to branch on a given input. This is possible because the group number for a group call can be the result of a lookup in a conversion table. To use this in the virtual processor another table, `instruction`, is added to map an opcode or mnemonic to a group that will execute this instruction:

| mnemonic | group |
|:---------|:------|
| NOP      | 1000  |
| HLT      | 1010  |

Because more than one group might be needed due to the limitations of nonrecursive operations it makes sense to keep some free groups between instructions.

#### Updating the PC ####
Updating the program counter to point to the next instruction will be something most instructions need so that is another basic function to add to the processor.
When looking a implementing a basic _NOP_ all we really have to do is a simple `pc++` and go to the next cycle.
This is not as simple as it would appear because Netrix has no arithmetic operations, a work around is to use another conversion table for looking up the result of the operation as a value. Of course this will only work for systems with set maximum values for numbers, but when making 8 bit numbers a constraint it is no problem at all:

| number | +1  |
|:-------|:----|
| 0      | 1   |
| 1      | 2   |
| 2      | 3   |
| ...    | ... |
| 255    | 0   |

Because reverse lookup is available this table works for both `+1` and `-1` operations, this table will be known as `diff1`. It's a bit awkward but works well enough.

#### Putting it all together ####
Putting all the previous bits together gives the following pseudo code that can read and execute NOP and HLT instructions.

```
instruction {
        "NOP" = instrNOP,
        "HLT" = instrHLT
}

diff1 = {
        0 = 1,
        1 = 2,
        2 = 3,
        ...
        255 = 0
}

readInstruction(location) {
        processor.instr = memory[location]
}

executeInstruction(mnemonic) {
        instructions[mnemonic]()
}

incPC(pc) {
        register.pc = diff1[pc]
}

stepCPU() {
        readInstruction(register.pc)
        executeInstruction(processor.instr)
}

instrNOP() {
        incPC(register.pc)
        stepCPU()
}

instrHLT() {

}

run() {
        register.pc = 0
        stepCPU()
}
```

Translating this to the configuration of the Netrix gives flow given below. I have added an extra group that will print debug messages so we know what's going on.

Group 1 - run()

| Type            | Parameters                                                      | Explanation       |
|:----------------|:----------------------------------------------------------------|:------------------|
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = pc<br />value = 0 | `register.pc = 0` |
| Group           | group = 100                                                     | `stepCPU()`       |

Group 100 - stepCPU()

| Type         | Parameters                                       | Explanation                           |
|:-------------|:-------------------------------------------------|:--------------------------------------|
| Group MSG1-6 | group = 101<br/>MSG1 = &[GETVAR]register,pc]     | `readInstruction(register.pc)`        |
| Group MSG1-6 | group = 102<br/>MSG1 = &[GETVAR]processor,instr] | `executeInstruction(processor.instr)` |

Group 101 - readInstruction(location)

| Type            | Parameters                                                                        | Explanation                      |
|:----------------|:----------------------------------------------------------------------------------|:---------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = processor<br/>var = instr<br />value = &[MSG1C]memory] | `processor.instr = memory[MSG1]` |

Group 102 - executeInstruction(mnemonic)

| Type  | Parameters                    | Explanation                |
|:------|:------------------------------|:---------------------------|
| Group | group = &[MSG1C]instructions] | `instructions[mnemonic]()` |

Group 103 - incPC(pc)

| Type            | Parameters                                                                  | Explanation                        |
|:----------------|:----------------------------------------------------------------------------|:-----------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = pc<br/>value = &[MSG1C]diff1] | `register.pc = diff1[register.pc]` |

Group 1000 - instrNOP()

| Type         | Parameters                                   | Explanation          |
|:-------------|:---------------------------------------------|:---------------------|
| Group MSG1-6 | group = 9000<br/>MSG1 = "NOP"                | `debug("NOP")`       |
| Group MSG1-6 | group = 103<br/>MSG1 = &[GETVAR]register,pc] | `incPC(register.pc)` |
| Group        | group = 100                                  | `stepCPU()`          |

Group 1010 - instrHLT()

| Type         | Parameters                    | Explanation    |
|:-------------|:------------------------------|:---------------|
| Group MSG1-6 | group = 9000<br/>MSG1 = "HLT" | `debug("HLT")` |

Group 9000 - debug(message)

| Type         | Parameters     | Explanation   |
|:-------------|:---------------|:--------------|
| COMMON DEBUG | message = &[MSG1] | `print(MSG1)` |

#### First test run ####
Let's try the vm with a simple program, to do this we load a simple program in the memory table:

| address | content |
|:--------|:--------|
| 0       | NOP     |
| 1       | NOP     |
| 2       | HLT     |

And we rig up a group to start the vm, this group sets the pc field in the register table to `0` and calls group 100 to start the execution. Then we can call this group once to "boot" the vm!
If everything is configured correctly this will result in the common debug window displaying the instructions that were called:
```
NOP
NOP
HLT
```


Making _Netrix Virtual Machine_ Turing complete
-------

#### Unconditional branching ####
Because the `pc` register points to the instruction to execute in the next CPU cycle it is quite easy to implement unconditional branching. We just need to read operand 1 which is the destination of the jump and set the `pc` to that address before calling stepCPU().
Since other instructions will also have to read one or more operands it's a good time to implement a way to read operands following an instruction. These operands will be read into a location of the volatile `processor` memory space. We start by making a copy of the value of the `pc` and increase this by 1 for each operand we read. The incPC() function will be removed and replaced by a function that calls `incVolatilePC()`, `register.pc = processor.pc` and `stepCPU()` prevent duplicated functions.

```
incVolatilePCandStep() {
        incVolatilePC()
        register.pc = processor.pc
        stepCPU()
}

setVolatilePC() {
        processor.pc = register.pc
}

incVolatilePC(volatilePC) {
        processor.pc = diff1[volatilePC]
}

setVolatileFromMemory(destination, address) {
        processor.destination = memory[address]
}

setVolatileOperand(destination) {
        incVolatilePC(processor.pc)
        setVolatileFromMemory(destination, processor.pc)
}

instrJMP() {
        setVolatilePC()
        setVolatileOperand(operand1)
        register.pc = processor.operand1
        stepCPU()
}
```

Group 103 - incVolatilePCandStep()

| Type            | Parameters                                                                          | Explanation                   |
|:----------------|:------------------------------------------------------------------------------------|:------------------------------|
| Group MSG1-6    | group = 105<br/>MSG1 = &[GETVAR]processor,pc]                                       | `incVolatilePC(processor.pc)` |
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = pc<br/>value = &[GETVAR]processor,pc] | `register.pc = processor.pc`  |
| Group           | group = 100                                                                         | `stepCPU()`                   |

Group 104 - setVolatilePC()

| Type            | Parameters                                                                          | Explanation                  |
|:----------------|:------------------------------------------------------------------------------------|:-----------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = processor<br/>var = pc<br/>value = &[GETVAR]register,pc] | `processor.pc = register.pc` |

Group 105 - incVolatilePC(volatilePC)

| Type            | Parameters                                                                   | Explanation                        |
|:----------------|:-----------------------------------------------------------------------------|:-----------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = processor<br/>var = pc<br/>value = &[MSG1C]diff1] | `processor.pc = diff1[volatilePC]` |

Group 106 - setVolatileFromMemory(destination, address)

| Type            | Parameters                                                                         | Explanation                               |
|:----------------|:-----------------------------------------------------------------------------------|:------------------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = processor<br/>var = &[MSG1]<br/>value = &[MSG2C]memory] | `processor.destination = memory[address]` |

Group 107 - setVolatileOperand(destination)

| Type         | Parameters                                                       | Explanation                                        |
|:-------------|:-----------------------------------------------------------------|:---------------------------------------------------|
| Group MSG1-6 | group = 105<br/>MSG1 = &[GETVAR]processor,pc]                    | `incVolatilePC(processor.pc)`                      |
| Group MSG1-6 | group = 106<br/>MSG1 = &[MSG1]<br/>MSG2 = &[GETVAR]processor,pc] | `setVolatileFromMemory(destination, processor.pc)` |


Group 1020 - instrJMP()

| Type            | Parameters                                                                                | Explanation                          |
|:----------------|:------------------------------------------------------------------------------------------|:-------------------------------------|
| Group           | group = 104                                                                               | `setVolatilePC()`                    |
| Group MSG1-6    | group = 107<br/>MSG1 = "operand1"                                                         | `setVolatileOperand(operand1)`       |
| Group MSG1-6    | group = 9000<br/>MSG1 = "JMP &[GETVAR]processor,operand1]"                                | `debug("JMP " + processor.operand1)` |
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = pc<br/>value = &[GETVAR]processor,operand1] | `register.pc = processor.operand1`   |
| Group           | group = 100                                                                               | `stepCPU()`                          |

Time for another simple program to test the jump:

| address | content |
|:--------|:--------|
| 0       | NOP     |
| 1       | JMP     |
| 2       | 4       |
| 3       | NOP     |
| 4       | HLT     |

Executing this program results in a successful jump:
```
NOP
JMP 4
HLT
```

#### Reading and writing from memory ####
A processor needs to move data around do anything useful, so now is a nice time to implement that. I will add an _accumulator_ register to the virtual cpu called `a` and add instructions to move data from memory to the accumulator and move data from the accumulator to memory. This will result in two instructions: _MOVMA_, _MOVAM_. Because immediate values are also useful an additional _MOVIA_ will also be implemented.

```
setRegisterFromMemory(destination, address) {
        register.destination = memory[address]
}

setMemoryFromImmediate(address, value) {
        memory[address] = value
}

instrMOVMA() {
        setVolatilePC()
        setVolatileOperand(operand1)
        setRegisterFromMemory(a, processor.operand1)
        incVolatilePCandStep()
}

instrMOVAM() {
        setVolatilePC()
        setVolatileOperand(operand1)
        setMemoryFromImmediate(processor.operand1, register.a)
        incVolatilePCandStep()
}

instrMOVIA() {
        setVolatilePC()
        setVolatileOperand(operand1)
        register.a = processor.operand1
        incVolatilePCandStep()
}
```

Group 108 - setRegisterFromMemory(destination, address)

| Type            | Parameters                                                                        | Explanation                              |
|:----------------|:----------------------------------------------------------------------------------|:-----------------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = &[MSG1]<br/>value = &[MSG2C]memory] | `register.destination = memory[address]` |


Group 109 - setMemoryFromImmediate(address, value)

| Type            | Parameters                                                              | Explanation               |
|:----------------|:------------------------------------------------------------------------|:--------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = memory<br/>var = &[MSG1]<br/>value = &[MSG2] | `memory[address] = value` |

Group 1030 - instrMOVMA()

| Type         | Parameters                                                       | Explanation                                              |
|:-------------|:-----------------------------------------------------------------|:---------------------------------------------------------|
| Group        | group = 104                                                      | `setVolatilePC()`                                        |
| Group MSG1-6 | group = 107<br/>MSG1 = "operand1"                                | `setVolatileOperand(operand1)`                           |
| Group MSG1-6 | group = 9000<br/>MSG1 = "MOVIA &[GETVAR]processor,operand1]"     | `debug("MOVMA " + processor.operand1)`                   |
| Group MSG1-6 | group = 108<br/>MSG1 = a<br/>MSG2 = &[GETVAR]processor,operand1] | `setRegisterFromMemory(destination, processor.operand1)` |
| Group        | group = 103                                                      | `incVolatilePCandStep()`                                 |

Group 1040 - instrMOVAM()

| Type         | Parameters                                                                          | Explanation                                              |
|:-------------|:------------------------------------------------------------------------------------|:---------------------------------------------------------|
| Group        | group = 104                                                                         | `setVolatilePC()`                                        |
| Group MSG1-6 | group = 107<br/>MSG1 = "operand1"                                                   | `setVolatileOperand(operand1)`                           |
| Group MSG1-6 | group = 9000<br/>MSG1 = "MOVAM &[GETVAR]processor,operand1]"                        | `debug("MOVAM " + processor.operand1)`                   |
| Group MSG1-6 | group = 109<br/>MSG1 = &[GETVAR]processor,operand1]<br/>MSG2 = &[GETVAR]register,a] | `setMemoryFromImmediate(processor.operand1, register.a)` |
| Group        | group = 103                                                                         | `incVolatilePCandStep()`                                 |


Group 1050 - instrMOVIA()

| Type            | Parameters                                                                               | Explanation                            |
|:----------------|:-----------------------------------------------------------------------------------------|:---------------------------------------|
| Group           | group = 104                                                                              | `setVolatilePC()`                      |
| Group MSG1-6    | group = 107<br/>MSG1 = "operand1"                                                        | `setVolatileOperand(operand1)`         |
| Group MSG1-6    | group = 9000<br/>MSG1 = "MOVIA &[GETVAR]processor,operand1]"                             | `debug("MOVIA " + processor.operand1)` |
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = a<br/>value = &[GETVAR]processor,operand1] | `register.a = processor.operand1`      |
| Group           | group = 103                                                                              | `incVolatilePCandStep()`               |

Testing will show that moving stuff around works like a charm. So let's move on to doing things with the stuff we can now move.

#### Decrement accumulator ####
Before working on conditional branching we must implement something that will give conditions on which to branch. We will do this by adding an instruction to decrement the accumulator. When the accumulator gets down to zero a _zeroflag_ will be set in the register table which we can use for branching later on.
Decrementing is accomplished with reverse lookup in the `diff1` table. Because the Netrix cannot do arithmetic and is not aware of numbers a test to check if something is zero will be a bit more complicated. Once again we have to resort to a lookup table, since the constraint of numbers being 8 bits integers was put forth for memory addresses we can continue on this path and generate a lookup table _iszero_ that is _true_ for value `0` and _false_ for `1` upto `255`. The zero flag will take one of the `true` or `false` values after checking.

_DECA_ explained:

```
iszero = {
        0 = true,
        1 = false,
        2 = false,
        ...
        255 = false
}

testZero(value) {
        register.zero = iszero[value]
}

instrDECA-decr(value) {
        register.a = diff1_reverse[value]
}

instrDECA() {
        setVolatilePC()
        instrDECA-decr(register.a)
        testZero(register.a)
        incVolatilePCandStep()
}
```

Group 110 - testZero(value)

| Type            | Parameters                                                                     | Explanation                     |
|:----------------|:-------------------------------------------------------------------------------|:--------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = zero<br/>value = &[MSG1C]iszero] | `register.zero = iszero[value]` |

Group 1060 - instrDECA()

| Type         | Parameters                                   | Explanation                  |
|:-------------|:---------------------------------------------|:-----------------------------|
| Group        | group = 104                                  | `setVolatilePC()`            |
| Group MSG1-6 | group = 9000<br/>MSG1 = "DECA"               | `debug("DECA")`              |
| Group MSG1-6 | group = 1061<br/>MSG1 = &[GETVAR]register,a] | `instrDECA-decr(register.a)` |
| Group MSG1-6 | group = 110<br/>MSG1 = &[GETVAR]register,a]  | `testZero(register.a)`       |
| Group        | group = 103                                  | `incVolatilePCandStep()`     |

Group 1061 - instrDECA-decr(value)

| Type            | Parameters                                                                  | Explanation                         |
|:----------------|:----------------------------------------------------------------------------|:------------------------------------|
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = a<br/>value = &[MSG1CS]diff1] | `register.a = diff1_reverse[value]` |

#### Conditional branching ####
Now that the zero flag is in place and working we can finally implement conditional branching: _JMPZ_ (jump if zero flag is true). As seen before when picking the right group to call to execute an instruction conditional operations in the Netrix have to be built using conversion tables.
The construction will be to have a conversion table that has a value true pointing to a group that will execute the _true_ branch and another entry to the group that handles the _false_ branch:

| value | branch |
|:------|:-------|
| true  | 1072   |
| false | 1073   |

To put that in pseudo code:

```
jmpz-boolean = {
        true = instrJMPZ-true,
        false = instrJMPZ-false
}

instrJMPZ-test(zeroflag) {
        jmpz-boolean[zeroflag]()
}

instrJMPZ-true() {
        register.pc = processor.operand1
        stepCPU()
}

instrJMPZ-false() {
        incVolatilePCandStep()
}

instrJMPZ() {
        setVolatilePC()
        setVolatileOperand(operand1)
        instrJMPZ-test(register.zero)
}
```

Group 1070 - instrJMPZ()

| Type         | Parameters                                      | Explanation                     |
|:-------------|:------------------------------------------------|:--------------------------------|
| Group        | group = 104                                     | `setVolatilePC()`               |
| Group MSG1-6 | group = 107<br/>MSG1 = "operand1"               | `setVolatileOperand(operand1)`  |
| Group MSG1-6 | group = 1071<br/>MSG1 = &[GETVAR]register,zero] | `instrJMPZ-test(register.zero)` |

Group 1071 - instrJMPZ-test(zeroflag)

| Type  | Parameters                    | Explanation                |
|:------|:------------------------------|:---------------------------|
| Group | group = &[MSG1C]jmpz-boolean] | `jmpz-boolean[zeroflag]()` |

Group 1072 - instrJMPZ-true()

| Type            | Parameters                                                                                | Explanation                                |
|:----------------|:------------------------------------------------------------------------------------------|:-------------------------------------------|
| Group MSG1-6    | group = 9000<br/>MSG1 = "JMPZ true &[GETVAR]processor,operand1]"                          | `debug("JMPZ true " + processor.operand1)` |
| CONVERSIONTABLE | type = Add var<br/>table = register<br/>var = pc<br/>value = &[GETVAR]processor,operand1] | `register.pc = processor.operand1`         |
| Group           | group = 100                                                                               | `stepCPU()`                                |

Group 1073 - instrJMPZ-false()

| Type            | Parameters                           | Explanation              |
|:----------------|:-------------------------------------|:-------------------------|
| Group MSG1-6    | group = 9000<br/>MSG1 = "JMPZ false" | `debug("JMPZ false")`    |
| Group           | group = 103                          | `incVolatilePCandStep()` |

So now a little program to bring it all together:

```
        MOVMA   var1
repeat:
        DECA
        JMPZ    end
        JMP     repeat
end:
        HLT

var1:
        2

```

As loaded into the memory conversion table:

| address | content |
|:--------|:--------|
| 0       | MOVMA   |
| 1       | 10      |
| 2       | DECA    |
| 3       | JMPZ    |
| 4       | 7       |
| 5       | JMP     |
| 6       | 2       |
| 7       | HLT     |
| 10      | 2       |

Running this will result in a an output showing the following:
```
MOVMA 10
DECA
JMPZ false
JMP 2
DECA
JMPZ true 7
HLT
```

The virtual machine is now Turing complete because we have implemented reading/writing of memory and conditional branching.

All other operations can be synthesised from the operations implemented. For instance to implement (unsigned) subtraction of values _a_ and _b_ (a - b), it is sufficient to keep decrementing _a_ and _b_ both by 1 until b gets down to zero. What's left in _a_ is the result of the operation.

#### Stack issues ####
Alert readers might have noticed that we keep calling the stepCPU() function from within a branch of this function, this means every cycle will be executed as a child of the previous cycle and thus keep eating up stack space on the host system. Using a feature called _repeat calls_ we can work around this. This feature is used to keep repeating actions until the TTL runs out or until it is reset. Thus starting a chain of events from one parent event repeatedly. The problem is the minimum interval before sending a message is 5 seconds so that would make our cpu quite slow.
The alternative I came up with means adding two input/outputs of the type IP and configuring them in a loopback configuration. This way a function tickCPU() will send a message that triggers another execution of the stepCPU() group! Where we called the stepCPU() function directly from other groups before, we switch that to tickCPU() and can enjoy the virtual CPU happily ticking away in an explosion of TCP packets :-)

IP-1:

| Setting  | Value         |
|:---------|:--------------|
| Name     | Loopback out  |
| Protocol | TCP/IP CLIENT |
| Port     | 6000          |
| Input    | EssecProtocol |

IP-2:

| Setting  | Value         |
|:---------|:--------------|
| Name     | Loopback in   |
| Protocol | TCP/IP HOST   |
| Port     | 6000          |
| Input    | EssecProtocol |

Group 112 - tickCPU()

| Type | Parameters                                           | Explanation                |
|:-----|:-----------------------------------------------------|:---------------------------|
| IP   | IP = 1<br/>Protocol<br/> Header = 10<br/>DI 01 = 100 | `Group call for group 100 on remote host of IP 1` |

In conclusion
-------------

I think the goal of making a Turing complete virtual machine within the posed constraints has been reached quite well. It has been fun to look for ways to abuse the system to get to this point. The configuration I made for this article is available in a separate [repository](https://github.com/eriknl/NetrixVM) to try out on your own Netrix.

**Understand that this is merely an exercise of the mind and everybody can understand you should not run hacks like this in a production environment where lives literally depend on this messaging server.**

Of course a big thumbs up to the guys from IndigoCare who're always pretty responsive to feature requests and open about the protocols theirs products use!
