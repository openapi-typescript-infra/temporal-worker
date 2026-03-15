# workflow

This entry point has to be separated from the main package export because workflows use webpack to bundle their code, and you cannot pull in all the node service infra in that environment.

So these are methods meant to only be used from workflows.
