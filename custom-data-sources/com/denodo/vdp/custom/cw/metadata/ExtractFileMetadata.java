package com.denodo.vdp.custom.cw.metadata;

import com.denodo.vdb.engine.customwrapper.AbstractCustomWrapper;
import com.denodo.vdb.engine.customwrapper.CustomWrapperConfiguration;
import com.denodo.vdb.engine.customwrapper.CustomWrapperException;
import com.denodo.vdb.engine.customwrapper.CustomWrapperInputParameter;
import com.denodo.vdb.engine.customwrapper.CustomWrapperResult;
import com.denodo.vdb.engine.customwrapper.CustomWrapperSchemaParameter;
import com.denodo.vdb.engine.customwrapper.condition.CustomWrapperConditionHolder;
import com.denodo.vdb.engine.customwrapper.expression.CustomWrapperFieldExpression;
import com.denodo.vdb.engine.customwrapper.input.type.CustomWrapperInputParameterTypeFactory;
import com.denodo.vdb.engine.customwrapper.input.value.CustomWrapperInputParameterLocalRouteValue;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.log4j.Logger;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.xml.sax.ContentHandler;

public class ExtractFileMetadata extends AbstractCustomWrapper {
  static final Logger logger = Logger.getLogger(ExtractFileMetadata.class);
  
  private static final String FILEPATH_PARAM = "FilePath";
  
  public CustomWrapperSchemaParameter[] getSchemaParameters(Map<String, String> inputValues) throws CustomWrapperException {
    return new CustomWrapperSchemaParameter[] { new CustomWrapperSchemaParameter("filePath", 12), 
        new CustomWrapperSchemaParameter("metadata_key", 12), 
        new CustomWrapperSchemaParameter("metadata_value", 12) };
  }
  
  public CustomWrapperInputParameter[] getInputParameters() {
    return new CustomWrapperInputParameter[] { new CustomWrapperInputParameter("FilePath", "A mandatory parameter with the filePath type string", 
          true, CustomWrapperInputParameterTypeFactory.routeType(CustomWrapperInputParameterTypeFactory.RouteType.values())) };
  }
  
  public CustomWrapperConfiguration getConfiguration() {
    CustomWrapperConfiguration conf = super.getConfiguration();
    conf.setDelegateProjections(false);
    return conf;
  }
  
  public void run(CustomWrapperConditionHolder condition, List<CustomWrapperFieldExpression> projectedFields, CustomWrapperResult result, Map<String, String> inputValues) throws CustomWrapperException {
    CustomWrapperInputParameterLocalRouteValue localRoute = (CustomWrapperInputParameterLocalRouteValue)getInputParameterValue(
        "FilePath");
    String filePath = localRoute.getPath();
    logger.error("File Metadata CW FilePath: " + filePath);
    File file = new File(filePath);
    AutoDetectParser autoDetectParser = new AutoDetectParser();
    BodyContentHandler handler = new BodyContentHandler();
    Metadata metadata = new Metadata();
    try {
      FileInputStream inputstream = new FileInputStream(file);
      ParseContext context = new ParseContext();
      autoDetectParser.parse(inputstream, (ContentHandler)handler, metadata, context);
      String[] metadataNames = metadata.names();
      byte b;
      int i;
      String[] arrayOfString1;
      for (i = (arrayOfString1 = metadataNames).length, b = 0; b < i; ) {
        String name = arrayOfString1[b];
        result.addRow(new Object[] { filePath, name, metadata.get(name) }, projectedFields);
        b++;
      } 
    } catch (IOException|org.xml.sax.SAXException|org.apache.tika.exception.TikaException e) {
      throw new CustomWrapperException(e.getMessage(), e);
    } 
  }
}
