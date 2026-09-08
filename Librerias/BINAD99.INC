;************************************** Librería "BINAD99.INC" **************************************
;
;
;
;
;     ====================================================================================
;     ||                               PROYECTO DE GRADO                                ||
;     ||                                                                                ||
;     ||     ESTUDIO Y DISEÑO DE ALGORITMOS E INTERFAZ ELECTRÓNICA DE COMUNICACIÓN      ||
;     ||    ENTRE MICROCONTROLADORES SERIE PIC Y DISPOSITIVOS DE ALMACENAMIENTO USB     ||
;     ||                                                                                ||
;     ||                           Juan Pablo Ruiz Rosero                               ||
;     ||                           Ingeniería Electrónica                               ||
;     ||                            Universidad de Nariño                               ||
;     ||                                Octubre 2008                                    ||
;     ====================================================================================
;
;
;****************************************************************************************************


; ZONA DE DATOS *************************************************************************************
;****************************************************************************************************
;****************************************************************************************************

	CBLOCK
	D99UNI		; Unidades
	D99DEC		; Decenas
	ENDC


; ZONA DE FUNCIONES *********************************************************************************
;****************************************************************************************************
;****************************************************************************************************


;FUNCION DE BINARIO A DECIMAL 99 *******************************************************************
; Esta función convierte un valor de binario a decimal igual o menor a 99. El dato de entrada se 
; lo coloca en W y la función devuelve su respuesta en W donde el nibble mayor representa las
; centenas y el nibble menor las unidades. Si el dato de entrada es mayor a 99 devuelve el Carry
; en 1 y si el dato es menor o igual a 99 devuelve el Carry 0.
BINAD99
	MOVWF	D99UNI			; Coloca el dato de entrada en D99UNI
	CLRF	D99DEC			; Coloca en cero a D99DEC
BINAD991
	MOVLW	d'10'			; Resta 10 a D99UNI y lo almacena en W
	SUBWF	D99UNI,W
	BTFSS	STATUS,C
	GOTO	BINAD99F		; Si el resultado es negativo, D99UNI<10 termina
BINAD992				; Si el resultado es cero o positivo, D99UNI>=10
	MOVWF	D99UNI			; Aplica el resultado de la resta sobre D99UNI
	INCF	D99DEC,F		; Incrementa en uno las decenas
	MOVLW	d'10'			; Resta 10 a D99UNI para saber si las decenas
	SUBWF	D99DEC,W		; son mayores que 10
	BTFSS	STATUS,C		
	GOTO	BINAD991		; Si el resultado es negativo, D99DEC<10 continua
BINAD99E				; si es positivo, D99DEC>10 va a error
	MOVWF	D99DEC	
	BSF	STATUS,C		; Coloca el Carry en 1 para avizar que hay un error
	RETURN				; Finaliza
BINAD99F
	SWAPF	D99DEC,F		; Rota los nibbles de D99DEC
	MOVF	D99DEC,W		
	ADDWF	D99UNI,W		; Los suma con D99UNI en W.
	BCF	STATUS,C		; Coloca el Carry en 0, operación exitosa
	RETURN				; Termina la función
	

BINAUNIC
	CALL	BINAD99
	ANDLW	0x0F
	ADDLW	'0'
	RETURN

BINADECC		
	CALL	BINAD99
	ANDLW	0xF0
	MOVWF	D99DEC
	SWAPF	D99DEC,W
	ADDLW	'0'
	RETURN