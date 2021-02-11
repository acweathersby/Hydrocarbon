- USE TYPE Labels to short circuit assertions
    In addition to the integral types 
    `TokenSpace`
    `TokenNumber`
    `TokenIdentifier`
    `TokenIdentifierUnicode`
    `TokenNewLine`
    `TokenSymbol`
    `TokenFullNumber`
    Add a type identifier number to each defined symbol
    So repeated lookups can skip long chains of assertions
    and assert the type. If the lexer type is 0, then an
    assertion must be made, otherwise use the type as a 
    short circuit calculation 

- #### Factor out trivial productions: 
  A trivial production is one where all bodies of the form <img src="https://render.githubusercontent.com/render/math?math=A:a_i"> 
  for all bodies <img src="https://render.githubusercontent.com/render/math?math=b^i"> in the production `A`.
  If there are no `reduce` actions present on every body, then the production call can be replaced
  with `a || a || a || a => red A` which translates to a `shift(a)` call in recursive descent recognizer

- #### Use sentinel look ahead to allow parrellel processing of input.
