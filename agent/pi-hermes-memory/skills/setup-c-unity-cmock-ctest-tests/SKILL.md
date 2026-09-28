---
name: "setup-c-unity-cmock-ctest-tests"
description: "Set up C unit testing in a repo using CMake, Unity, CMock, Ruby-generated runners, CTest, and optional gcov/lcov coverage."
version: 1
created: "2026-06-03"
updated: "2026-06-03"
---
## When to Use
Use when a C/CMake repository needs a separate host-side unit test build, runnable locally and in CI, with optional mocking and coverage.

## Procedure
1. Add a root CMake switch such as BUILD_TYPE with values like FIRMWARE and UNIT_TESTS.
2. In the UNIT_TESTS branch, call enable_testing(), include(CTest), and add_subdirectory() for a dedicated test framework folder.
3. Vendor or add as submodules the Unity and CMock sources, plus any helper scripts used to generate mocks and test runners.
4. Create a framework CMakeLists.txt that builds static libraries for unity and cmock and then adds the directories containing testable modules.
5. For each module under test, create a CMakeLists.txt that defines MODULE_NAME, MODULE_SOURCES, HEADER_FILES, and TEST_SOURCES, builds the module as a static library, and includes a shared generate_mocks.cmake helper.
6. In generate_mocks.cmake, generate mocks from headers with CMock via Ruby, generate per-test runner files with Unity's generate_test_runner.rb, build each test as an executable, and register it with add_test().
7. Create a shell script such as unitTest.sh with three phases: --prepare to configure CMake with -DBUILD_TYPE=UNIT_TESTS, --build to compile the tests, and --run to execute ctest with output-on-failure and coverage options.
8. Add an optional coverage helper in CMake that enables -coverage compile/link flags and provides a coverage target using lcov and genhtml.
9. Add IDE tasks (for example VS Code tasks) that call the script for configure, build, and run steps.
10. Add a CI stage that installs or demands CMake, GCC, Ninja, Git, and Ruby, checks out submodules, runs prepare/build/run, and publishes test and coverage artifacts.
11. Keep manual on-target diagnostics separate from host-side unit tests; if needed, add a runtime test console in firmware, but do not mix it into the unit test path.

## Pitfalls
- Do not mix the embedded firmware toolchain build with host-side unit tests; use a separate BUILD_TYPE or separate build directory.
- CMock and Unity runner generation require Ruby; CI and developer environments must have it installed.
- Coverage tools differ by platform; gcov may work directly, while HTML reports often need lcov and genhtml.
- If your root CMake validates embedded-only tool paths, provide harmless dummy values or refactor validation so UNIT_TESTS does not require embedded tools.
- Start with small module-level tests and examples first, then add real production modules under test rather than leaving only demo examples.

## Verification
1. cmake -S . -B build/tests -G Ninja -DBUILD_TYPE=UNIT_TESTS configures successfully.
2. cmake --build build/tests completes and produces per-test executables.
3. ctest --test-dir build/tests --output-on-failure passes.
4. Coverage artifacts are generated when coverage is enabled.
5. CI has a dedicated unit-test stage that runs independently of the firmware build.