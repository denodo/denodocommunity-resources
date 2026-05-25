#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
View Complexity Analysis FastAPI Server
- Receives view data from metadata analyzer UI
- Analyzes complexity using SQLGlot batch analyzer
- Returns JSON results with top complex views and full CSV data
- Designed for local Customer Success team usage

Usage:
  pip install fastapi uvicorn
  python view_complexity_server.py
  
API Endpoints:
  POST /analyze-complexity - Analyze views complexity
  GET /health - Health check
"""

import asyncio
import json
import tempfile
import os
from datetime import datetime
from typing import List, Dict, Optional
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Import our batch analyzer
from view_complexity_batch_analyzer import analyze_view_batch, save_results

# ----------------------------
# FastAPI App Setup
# ----------------------------

app = FastAPI(
    title="View Complexity Analysis API",
    description="Local FastAPI server for analyzing VQL view complexity using SQLGlot",
    version="1.0.0"
)

# Enable CORS for local development (metadata analyzer UI)
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve Next.js static files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BUILD_DIR = os.path.join(PROJECT_ROOT, "metadata-analyzer", "out")

# Add middleware to set COOP/COEP headers for DuckDB WASM
@app.middleware("http")
async def add_duckdb_headers(request, call_next):
    """Add Cross-Origin headers required for DuckDB WASM SharedArrayBuffer support"""
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

if os.path.exists(BUILD_DIR):
    print(f"✅ Found Next.js build directory: {BUILD_DIR}")

    # Mount Next.js static assets
    app.mount("/_next", StaticFiles(directory=os.path.join(BUILD_DIR, "_next")), name="nextjs")

    @app.get("/")
    async def serve_nextjs_app():
        """Serve the Next.js app's index.html"""
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))

    @app.get("/{catch_all:path}")
    async def serve_nextjs_catch_all(catch_all: str):
        """Serve Next.js static files and handle client-side routing"""
        # Skip API routes
        if catch_all.startswith("analyze-") or catch_all == "health":
            raise HTTPException(status_code=404, detail="Not found")

        # Try to serve static file first (for assets like .js, .css, images, .wasm, etc.)
        file_path = os.path.join(BUILD_DIR, catch_all)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        # For dynamic database routes like /databases/admin, serve the base database page
        if catch_all.startswith("databases/"):
            parts = catch_all.split("/")
            # If this is /databases/something (not /databases/index), serve the dynamic page
            if len(parts) >= 2 and parts[1] != "" and parts[1] != "index":
                db_detail_page = os.path.join(BUILD_DIR, "databases", "index", "index.html")
                print(f"🔍 Serving database detail page: {catch_all} -> {db_detail_page}")
                if os.path.isfile(db_detail_page):
                    return FileResponse(db_detail_page)
                else:
                    print(f"❌ Database detail page not found at: {db_detail_page}")

        # Try with index.html in directory
        html_path = os.path.join(BUILD_DIR, catch_all, "index.html")
        if os.path.isfile(html_path):
            return FileResponse(html_path)

        # Try direct .html file
        html_file = os.path.join(BUILD_DIR, f"{catch_all}.html")
        if os.path.isfile(html_file):
            return FileResponse(html_file)

        # Fallback to main index.html for client-side routing
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
else:
    print(f"⚠️  Next.js build directory not found at: {BUILD_DIR}")
    print("   Run 'cd meta-copy && npm run build' first.")

    @app.get("/")
    async def no_build_warning():
        return {"message": f"Next.js app not built. Build directory not found at: {BUILD_DIR}"}

# ----------------------------
# Request/Response Models
# ----------------------------

class ViewData(BaseModel):
    """Single view data from metadata analyzer"""
    name: str
    database: Optional[str] = "unknown"
    kind: Optional[str] = "view"
    selectBody: Optional[str] = None
    
class ComplexityAnalysisRequest(BaseModel):
    """Request payload for complexity analysis"""
    views: List[ViewData]
    dialect: Optional[str] = "ansi"
    topCount: Optional[int] = 20
    
class ComplexityResult(BaseModel):
    """Single view complexity result"""
    database: str
    name: str
    kind: str
    score: Optional[float]
    tier: str
    analyzed: bool
    joinsTotal: Optional[int] = None
    tables: Optional[int] = None
    ctes: Optional[int] = None
    recursiveCte: Optional[bool] = None
    subqueryDepth: Optional[int] = None
    scalarSubqueries: Optional[int] = None
    hasDistinct: Optional[bool] = None
    groupBy: Optional[bool] = None
    having: Optional[bool] = None
    windows: Optional[int] = None
    analyticFns: Optional[int] = None
    aggFns: Optional[int] = None
    caseExprs: Optional[int] = None
    fnCalls: Optional[int] = None
    andCount: Optional[int] = None
    orCount: Optional[int] = None
    cmpCount: Optional[int] = None
    sqlLength: Optional[int] = None
    error: Optional[str] = None
    # Add the name arrays for detailed view
    tableNames: Optional[List[str]] = None
    functionNames: Optional[List[str]] = None
    windowFunctionNames: Optional[List[str]] = None
    analyticFunctionNames: Optional[List[str]] = None
    aggFunctionNames: Optional[List[str]] = None
    joinsByType: Optional[Dict] = None
    setOps: Optional[Dict] = None
    flattenOps: Optional[int] = None
    # NEW: Denodo-specific fields
    denodoFunctions: Optional[Dict] = None
    denodoFunctionScore: Optional[float] = None
    rawScore: Optional[float] = None
    
class ComplexityAnalysisResponse(BaseModel):
    """Response payload for complexity analysis"""
    success: bool
    message: str
    total_views: int
    analyzed_successfully: int
    processing_time_seconds: float
    top_views: List[ComplexityResult]
    csv_data: str  # CSV content as string for UI download
    generated_timestamp: str

# ----------------------------
# API Endpoints
# ----------------------------

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "view-complexity-analyzer",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/analyze-complexity", response_model=ComplexityAnalysisResponse)
async def analyze_complexity(request: ComplexityAnalysisRequest):
    """
    Analyze view complexity for provided views
    
    Args:
        request: Contains views data, dialect, and options
        
    Returns:
        Analysis results with top views and CSV data
    """
    start_time = datetime.now()
    
    try:
        print(f"🔄 Starting complexity analysis for {len(request.views)} views...")
        
        # Convert Pydantic models to dict format for batch analyzer
        views_data = []
        for view in request.views:
            view_dict = {
                "name": view.name,
                "database": view.database or "unknown",
                "kind": view.kind or "view",
                "selectBody": view.selectBody
            }
            views_data.append(view_dict)
        
        # Filter out views without SELECT bodies
        analyzable_views = [v for v in views_data if v.get("selectBody")]
        skipped_count = len(views_data) - len(analyzable_views)
        
        if skipped_count > 0:
            print(f"⏭️ Skipping {skipped_count} views without SELECT statements")
        
        if not analyzable_views:
            return ComplexityAnalysisResponse(
                success=False,
                message="No views with SELECT statements found for analysis",
                total_views=len(request.views),
                analyzed_successfully=0,
                processing_time_seconds=0.0,
                top_views=[],
                csv_data="",
                generated_timestamp=datetime.now().isoformat()
            )
        
        # Run batch analysis
        results = analyze_view_batch(analyzable_views, request.dialect)
        
        # Calculate processing time
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # Sort results by score (highest first)
        def sort_key(item):
            score = item.get('score')
            return score if score is not None else -1
        
        sorted_results = sorted(results, key=sort_key, reverse=True)
        analyzed_count = len([r for r in results if r.get('analyzed', False)])
        
        # Get top views for UI display
        top_count = min(request.topCount, len(sorted_results))
        top_views = sorted_results[:top_count]
        
        # Convert to response models
        top_views_response = []
        for result in top_views:
            complexity_result = ComplexityResult(**result)
            top_views_response.append(complexity_result)
        
        # Generate CSV data
        csv_data = generate_csv_string(sorted_results)
        
        response = ComplexityAnalysisResponse(
            success=True,
            message=f"Successfully analyzed {analyzed_count} of {len(request.views)} views",
            total_views=len(request.views),
            analyzed_successfully=analyzed_count,
            processing_time_seconds=processing_time,
            top_views=top_views_response,
            csv_data=csv_data,
            generated_timestamp=datetime.now().isoformat()
        )
        
        print(f"✅ Analysis complete in {processing_time:.2f}s: {analyzed_count} successful")
        return response
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        print(f"❌ {error_msg}")
        
        return ComplexityAnalysisResponse(
            success=False,
            message=error_msg,
            total_views=len(request.views),
            analyzed_successfully=0,
            processing_time_seconds=(datetime.now() - start_time).total_seconds(),
            top_views=[],
            csv_data="",
            generated_timestamp=datetime.now().isoformat()
        )

# ----------------------------
# Helper Functions
# ----------------------------

def generate_csv_string(results: List[Dict]) -> str:
    """Generate CSV content as string matching original vql_view_complexity.py format"""
    import csv
    import io
    
    if not results:
        return ""
    
    # Define CSV fieldnames to match enhanced vql_view_complexity.py exactly
    fieldnames = [
        "database", "name", "kind", "score", "tier", "rawScore", "joinsTotal", "tables",
        "ctes", "recursiveCte", "setOps", "flattenOps", "subqueryDepth", "scalarSubqueries",
        "hasDistinct", "groupBy", "having", "windows", "analyticFns", "aggFns",
        "caseExprs", "fnCalls", "andCount", "orCount", "cmpCount", "joinsByType",
        "denodoFunctions", "denodoFunctionScore"
    ]
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for result in results:
        # Create row with exact format from original code
        row = {}
        
        # Basic fields
        row['database'] = result.get('database', '')
        row['name'] = result.get('name', '')
        row['kind'] = result.get('kind', '')
        row['score'] = result.get('score', '')  # This is now the normalized 0-100 score
        row['tier'] = result.get('tier', '')
        row['rawScore'] = result.get('rawScore', '')  # Original raw score
        
        # Complexity metrics
        row['joinsTotal'] = result.get('joinsTotal', 0)
        row['tables'] = result.get('tables', 0)
        row['ctes'] = result.get('ctes', 0)
        row['recursiveCte'] = result.get('recursiveCte', False)
        row['subqueryDepth'] = result.get('subqueryDepth', 0)
        row['scalarSubqueries'] = result.get('scalarSubqueries', 0)
        row['hasDistinct'] = result.get('hasDistinct', False)
        row['groupBy'] = result.get('groupBy', False)
        row['having'] = result.get('having', False)
        row['windows'] = result.get('windows', 0)
        row['analyticFns'] = result.get('analyticFns', 0)
        row['aggFns'] = result.get('aggFns', 0)
        row['caseExprs'] = result.get('caseExprs', 0)
        row['fnCalls'] = result.get('fnCalls', 0)
        row['andCount'] = result.get('andCount', 0)
        row['orCount'] = result.get('orCount', 0)
        row['cmpCount'] = result.get('cmpCount', 0)
        
        # Complex objects as string representations (matching original format)
        setOps = result.get('setOps', {})
        row['setOps'] = str(setOps) if setOps else "{}"
        row['flattenOps'] = result.get('flattenOps', 0)
        
        joinsByType = result.get('joinsByType', {})
        row['joinsByType'] = str(joinsByType) if joinsByType else "{}"
        
        # NEW: Denodo-specific fields
        denodoFunctions = result.get('denodoFunctions', {})
        row['denodoFunctions'] = str(denodoFunctions) if denodoFunctions else "{}"
        row['denodoFunctionScore'] = result.get('denodoFunctionScore', '')
        
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    return csv_content

# ----------------------------
# Development Server
# ----------------------------

def main():
    """Run the FastAPI development server"""
    print("🚀 Starting Denodo Metadata Analyzer (Next.js + DuckDB WASM)...")
    print("📍 Full app available at: http://localhost:41301")
    print()
    print("👥 Instructions:")
    print("   1. Open browser to: http://localhost:41301")
    print("   2. Upload VQL file to analyze")
    print("   3. Navigate between different analysis views")
    print("   4. Export reports and analyze complexity")
    print()
    
    uvicorn.run(
        "view_complexity_server:app",
        host="127.0.0.1", 
        port=41301,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()