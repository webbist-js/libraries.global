"""One published JSON Schema for the native boundary and TS conformance tests."""
import json
from pathlib import Path

from jsonschema import Draft202012Validator, validators
from jsonschema.exceptions import ValidationError

SCHEMA = json.loads((Path(__file__).parent / "contracts/reach.schema.json").read_text())
Draft202012Validator.check_schema(SCHEMA)
# Shapely mappings use tuples for coordinates; JSON encodes both as arrays.
BoundaryValidator = validators.extend(Draft202012Validator, type_checker=
    Draft202012Validator.TYPE_CHECKER.redefine("array", lambda _, value: isinstance(value, (list, tuple))))
VALIDATORS = {name: BoundaryValidator({**SCHEMA, "$ref": f"#/$defs/{name}"})
              for name in ("request", "job", "result", "networkJob", "networkResult")}


def validate_contract(name, value):
    try:
        VALIDATORS[name].validate(value)
    except ValidationError as error:
        raise ValueError(f"Invalid Reach {name} contract") from error
