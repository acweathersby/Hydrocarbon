<h1 align=center>CandleLibrary Hydrocarbon</h1>

<h3 align=center>Hybrid Parser Compiler</h3>

<p align=center> <img alt="npm (tag)" src="https://img.shields.io/npm/v/@candlelib/hydrocarbon?style=for-the-badge&logo=appveyor"> </p>


CandleLibrary Hydrocarbon is a parser compiler that is able to create a hybrid parsers from grammars described in Hydrocarbon 
Grammar (.hcg). This format is inspired by the Backus-Naur Form syntax and is designed to be easy to use and expressive in the type of grammar 
constructs that can be defined. In addition, production reduce actions can specified in JavaScript to allow a generated parser to create 
Abstract Syntax Trees (AST), and also execute other actions during parsing. 

Parsers generated by Hydrocarbon are in use within a majority of CandleLibrary packages (including Hydrocarbon itself), providing parsing 
facilities for full programming languages as in the case of CandleLibrary [JS](https://github.com/CandleLibrary/js), [TS](https://github.com/CandleLibrary/ts), & [CSS](https://github.com/CandleLibrary/css); Composite grammar parsing within [Wick](https://github.com/CandleLibrary/wick) (JS, MD, CSS, & HTML); and command line argument
parsing in [Paraffin](https://github.com/CandleLibrary/paraffin).

# Usage

## Install

### Yarn
```bash
$ yarn global add @candlelib/hydrocarbon
```

### NPM
```bash
$ npm install -g @candlelib/hydrocarbon
```

## Write A Grammar

[Checkout The Doc](./site/creating_a_grammar.index.md)

# Contribution

If you have any problems using hydrocarbon, or would like to suggest a new feature, please open an [issue](https://github.com/CandleLibrary/hydrocarbon/issues).

If you would like to contribute to the development of hydrocarbon, fork the repository, create and develop on a new branch, and create a pull request from your forked repo.

# License

Licensed under [GNU GPL v3](./LICENSE)

