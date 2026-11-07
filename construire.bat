@echo off
rem Compile Atziri Exchange (fork d'Exiled Exchange 2, licence MIT) et produit l'installateur Windows.
cd /d "%~dp0renderer"
call npm install || goto :err
call npm run make-index-files || goto :err
call npm run build || goto :err
cd /d "%~dp0main"
call npm install || goto :err
call npm run build || goto :err
call npm run package || goto :err
echo.
echo Termine. L'installateur est dans main\dist (Atziri Exchange Setup ... .exe).
pause
exit /b 0
:err
echo.
echo Une etape a echoue. Lis le message ci-dessus.
pause
exit /b 1
