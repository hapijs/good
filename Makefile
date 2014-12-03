test:
	@node node_modules/lab/bin/lab -m 5000 -La code
test-cov:
	@node node_modules/lab/bin/lab -m 5000 -t 100 -v -La code
test-cov-html:
	@node node_modules/lab/bin/lab -m 5000 -r html -o coverage.html -La code

.PHONY: test test-cov test-cov-html
