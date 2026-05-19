# ESP32社区AI助手API连接测试脚本 (PowerShell版本)

param(
    [string]$ServerIP = "192.168.1.58",
    [int]$Port = 3000
)

$BaseURL = "http://${ServerIP}:${Port}/api"

Write-Host "🚀 ESP32社区AI助手API连接测试" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "服务器地址: $BaseURL" -ForegroundColor Yellow
Write-Host ""

function Test-ServerHealth {
    Write-Host "🔍 测试服务器健康状态..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$BaseURL/health" -Method GET -TimeoutSec 10
        Write-Host "✅ 服务器状态: $($response.status)" -ForegroundColor Green
        Write-Host "📝 消息: $($response.message)" -ForegroundColor White
        Write-Host "⏰ 时间戳: $($response.timestamp)" -ForegroundColor Gray
        return $true
    }
    catch {
        Write-Host "❌ 服务器连接失败: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-AIStatus {
    Write-Host "`n🤖 测试AI服务状态..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$BaseURL/ai/status" -Method GET -TimeoutSec 10
        if ($response.success) {
            Write-Host "✅ AI服务状态: $($response.data.status)" -ForegroundColor Green
            Write-Host "🔧 提供商: $($response.data.provider)" -ForegroundColor White
            Write-Host "⏰ 时间戳: $($response.data.timestamp)" -ForegroundColor Gray
            return $true
        } else {
            Write-Host "❌ AI服务状态异常" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ AI服务连接失败: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-AIChat {
    param([string]$Message = "你好，请简单介绍一下你自己")
    
    Write-Host "`n💬 测试AI聊天功能..." -ForegroundColor Cyan
    Write-Host "📤 发送消息: $Message" -ForegroundColor Yellow
    
    try {
        $body = @{
            message = $Message
            userId = 1
            sessionId = "test_$(Get-Date -Format 'yyyyMMddHHmmss')"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BaseURL/ai/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
        
        if ($response.success) {
            Write-Host "✅ AI回复: $($response.data.message)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ AI聊天失败: $($response.error)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ AI聊天连接失败: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-ESP32Simulation {
    Write-Host "`n🔌 模拟ESP32设备测试..." -ForegroundColor Cyan
    
    $testMessages = @(
        "你好，我是ESP32设备",
        "请介绍一下社区服务", 
        "预约乒乓球室明天下午2点",
        "查看我的预约记录"
    )
    
    $successCount = 0
    for ($i = 0; $i -lt $testMessages.Count; $i++) {
        Write-Host "`n测试 $($i + 1)/$($testMessages.Count): $($testMessages[$i])" -ForegroundColor Yellow
        if (Test-AIChat -Message $testMessages[$i]) {
            $successCount++
        }
        Start-Sleep -Seconds 1
    }
    
    Write-Host "`n📊 ESP32模拟测试结果: $successCount/$($testMessages.Count) 成功" -ForegroundColor Cyan
    return $successCount -eq $testMessages.Count
}

function Test-NetworkConnectivity {
    Write-Host "`n🌐 测试网络连通性..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://${ServerIP}:${Port}/" -TimeoutSec 5
        Write-Host "✅ 基本连接正常 (状态码: $($response.StatusCode))" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ 基本连接失败: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Show-InteractiveChat {
    Write-Host "`n💬 进入交互式聊天模式" -ForegroundColor Green
    Write-Host "输入消息与AI对话，输入 'quit' 退出" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    while ($true) {
        try {
            $message = Read-Host "你"
            if ($message.ToLower() -in @('quit', 'exit', 'quit')) {
                break
            }
            
            if ($message) {
                Write-Host "AI: " -NoNewline -ForegroundColor Green
                if (Test-AIChat -Message $message) {
                    Write-Host ""  # 换行
                } else {
                    Write-Host "(AI回复失败)" -ForegroundColor Red
                }
            }
        }
        catch [System.Management.Automation.PipelineStoppedException] {
            Write-Host "`n退出聊天模式" -ForegroundColor Yellow
            break
        }
        catch {
            Write-Host "`n错误: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

function Show-Help {
    Write-Host "`n📋 可用命令:" -ForegroundColor Cyan
    Write-Host "1. 完整测试" -ForegroundColor White
    Write-Host "2. 交互式聊天" -ForegroundColor White
    Write-Host "3. 仅测试连接" -ForegroundColor White
    Write-Host "4. 显示帮助" -ForegroundColor White
}

function Run-FullTest {
    Write-Host "🚀 开始ESP32社区AI助手连接测试" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    
    $testResults = @()
    
    # 1. 网络连通性测试
    $testResults += @{Name = "网络连通性"; Result = (Test-NetworkConnectivity)}
    
    # 2. 服务器健康检查
    $testResults += @{Name = "服务器健康"; Result = (Test-ServerHealth)}
    
    # 3. AI服务状态检查
    $testResults += @{Name = "AI服务状态"; Result = (Test-AIStatus)}
    
    # 4. AI聊天功能测试
    $testResults += @{Name = "AI聊天功能"; Result = (Test-AIChat)}
    
    # 5. ESP32模拟测试
    $testResults += @{Name = "ESP32模拟"; Result = (Test-ESP32Simulation)}
    
    # 输出测试结果
    Write-Host "`n=================================" -ForegroundColor Green
    Write-Host "📋 测试结果汇总:" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    
    $passed = 0
    $total = $testResults.Count
    
    foreach ($test in $testResults) {
        $status = if ($test.Result) { "✅ 通过" } else { "❌ 失败" }
        $color = if ($test.Result) { "Green" } else { "Red" }
        Write-Host "$($test.Name.PadRight(15)): $status" -ForegroundColor $color
        if ($test.Result) { $passed++ }
    }
    
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "📊 总体结果: $passed/$total 测试通过" -ForegroundColor Cyan
    
    if ($passed -eq $total) {
        Write-Host "🎉 所有测试通过！ESP32设备可以正常连接AI服务" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⚠️ 部分测试失败，请检查服务器配置" -ForegroundColor Yellow
        return $false
    }
}

# 主程序
Write-Host "ESP32社区AI助手连接测试工具" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# 检查服务器IP参数
if ($args.Count -gt 0) {
    $ServerIP = $args[0]
    $BaseURL = "http://${ServerIP}:${Port}/api"
}

Write-Host "服务器IP: $ServerIP" -ForegroundColor Yellow
Write-Host ""

# 选择测试模式
Show-Help

do {
    $choice = Read-Host "`n请选择测试模式 (1-4)"
    
    switch ($choice) {
        "1" {
            $success = Run-FullTest
            if ($success) { exit 0 } else { exit 1 }
        }
        "2" {
            Show-InteractiveChat
            break
        }
        "3" {
            Test-NetworkConnectivity
            Test-ServerHealth
            Test-AIStatus
            break
        }
        "4" {
            Show-Help
        }
        default {
            Write-Host "无效选择，请重新输入" -ForegroundColor Red
        }
    }
} while ($choice -notin @("1", "2", "3"))
