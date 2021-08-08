#pragma once

#include "./type_defs.h"

/*
 * Copyright 2021 Anthony C Weathersby
 * Licensed under MIT
 */

// This is the base class for AST node structures defined within
// Hydrocarbon grammar files. This Class is subclassed using an
// automated JS-C++ conversion process.

namespace HYDROCARBON
{

  static const u64 NaNMask = (u64)0x7FF << 52;
  static const u64 NaNMask = (u64)0x7FF << 52;

  static const u64 FPSignBitMask = (u64)1 << 63;

  static const u64 PtrMask = ~(NaNMask | FPSignBitMask | 3);

  // [storage]
  // All objects associated with Hydrocarbon nodes use
  // the type object for pointer storage and type references.
  // It takes advantage of the IEEE 754 64bit signaling NaN
  // to store non FP data within a 64bit wide memory space

  // IEEE 754 64bit FP bits are organized into the following groups:
  // 63       : Sign
  // 62 - 52  : Exponent
  // 51 - 0   : Significand (Fraction)

  // The floating point is NaN if all Exponent bits are 1 and the Significand is a
  // non-zero value. Sign is ignored

  /**
 * Stores (token) string data and AST node ptr information
 *
 *
 */
  typedef struct ASTRef
  {

  private:
    unsigned long long store;

  public:
    ASTRef() : store(0) {}

    ASTRef(const ASTRef &ref) : store(ref.store) {}

    // For Node Pointers
    ASTRef(void *);

    // For Tokens
    ASTRef(unsigned offset, unsigned length);

    /**
   * True if the base type is a (AST) Node object.
   */
    bool isNode() const;
    /**
   * True if the base type is a (AST) Node voctor object.
   */
    bool isVector() const;
    /**
   * True if the base type is a offset length value pair.
   */
    bool isToken() const;

    /**
   * True if the base type
   */
    int ptrType() const;

    /**
   * If the type is a pointer then returns the pointer, otherwise returns
   * NULL;
   */
    void *toPtr() const;

    void print(const char *) const;

  } ASTRef;

  // Conversion operators ------------------------------------------------

  operator unsigned() const
  {
    if (isInt())
      return value.integer;
    return 0;
  }

  operator int() const
  {
    if (isInt())
      return value.integer;
    return 0;
  }

  operator double() const { return value.double_float; }

  operator void *() const { return toPtr(); }

}
ASTRef;

} // namespace HYDROCARBON
