@echo off
REM ---------------------------------------------------------------------------
REM  Environment variable JAVA_HOME must be set and exported
REM ---------------------------------------------------------------------------

SET DENODO_SUPPORT_UTILS_CLASSPATH=../lib/denodo-support-utils-1.3.jar

:javabinconfig
SET JAVA_BIN="%JAVA_HOME%\jre\bin\java.exe"
IF EXIST "%JAVA_BIN%" GOTO main

SET JAVA_BIN="%JAVA_HOME%\bin\java.exe"

:main
IF NOT EXIST "%JAVA_OPTS%" (
        SET JAVA_OPTS="-Xmx4m"
)

IF EXIST "%JAVA_BIN%" (
	%JAVA_BIN% %JAVA_OPTS% -classpath "%DENODO_SUPPORT_UTILS_CLASSPATH%" com.denodo.connect.support.utils.PortTester %2 %1 %3
	goto end
)

echo "Unable to execute '%0': Environment variable JAVA_HOME must be set"

:end
pause
