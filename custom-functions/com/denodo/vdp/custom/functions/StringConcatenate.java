package com.denodo.vdp.custom.functions;

import com.denodo.common.custom.annotations.CustomElement;
import com.denodo.common.custom.annotations.CustomElementType;
import com.denodo.common.custom.annotations.CustomExecutor;
import com.denodo.common.custom.annotations.CustomExecutorReturnType;
import com.denodo.common.custom.annotations.CustomParam;

@CustomElement(type=CustomElementType.VDPFUNCTION, name="StringConcatenate")
public class StringConcatenate {

    /**
     * This method is invoked when the custom function is executed
     *
     * @param input parameters
     *
     * @return custom value
     */
	@CustomExecutor(syntax = "StringConcatenate(text str_1, text str_2 ... text str_n): text")
    public String concat_sample(@CustomParam(name = "str") String... input) {

		 StringBuilder result = new StringBuilder();
         if (input != null) {
             for (String str : input) {
            	 result.append(str);                 
             }
         }

         return result.toString();     
    }

    @CustomExecutorReturnType
    public Class<String> executeReturnType (String... input) {
        //TODO Replace with your own code
        return String.class;
    }
}

