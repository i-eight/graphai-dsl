# AST

```
file := <graph>
graph := ( <static-node> | <computed-node>)+
static-node := static <identifier> = <expr>;
computed-node := (<identifier> = ({ <graph> }; | <expr>)) | <expr>;
identifier := (_ | <alphabet>) (_ | <alphabet> | <number>)*
alphabet := (a-z | A-Z)+

expr := <if>
      | <paren>
      | <identifier>
      | <literal>
      | <array-at>
      | <object-member>
      | <node-annotation>* <agent-call>
      | <agent-def>
      | <logical>

if := if <expr> then <expr> else <expr>
paren := "("<expr>")"
literal := <number> | <boolean> | <string> | <array> | <object> | null
number := '-'? (0-9)+ | (0-9)+ . (0-9)+
boolean := true | false
string := '(<any-char> | ${ <expr> })*'
array := [(<expr>,)*]
array-at := (<paren> | <array> | <identifier> | <agent-call>)[<expr>]
object := { (<key>: <expr>,)* }
key := <identifier>
object-member := (<parent> | <object> | <identifier> | <agent-call>).<key>
node-annotation := @<identifier>"(" <expr> ")"
agent-call := <identifier>"(" <expr> ")"
agent-def := "(" (<identifier> | <destruction-object>) ")" -> (<expr> | { <graph> })
destruction := <destruction-array> | <destruction-object>
destruction-array := [(<identfier> | <destruction>,)*]
destruction-object := { (<key>,)* } | { (<key>: (<identifier> | <destruction>),)* }

// a + b * c + d > e || f
power-base := <number> | <identifier> | <paren> | <array-at> | <object-member> | <agent-call>
power := <power-base> (^ <number>)+
term-mul-div-mod := <power-base> | <power>
mul-div-mod := (<mul-div-mod> | <term-mul-div-mod>) (* | / | %) <term-mul-div-mod>
term-plus-minus := <term-mul-div-mod> | <mul-div-mod>
plus-minus := (<plus-minus> | <term-plus-minus>) (+ | -) <term-plus-minus>
term-compare := <term-plus-minus> | <plus-minus>
compare := (<compare> | <term-compare>) (== | != | > | >= | < | <=) <term-compare>
term-logical := term-compare | <compare>
logical := (<logical> | <term-logical>) (&& | "||") <term-logical>
```
